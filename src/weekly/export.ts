import * as csv from 'fast-csv';
import moment, { Moment } from 'moment';
import MultiStream, { Readable } from 'multistream';
import { upload, createReadStream } from '../lib/storage';
import { getStage, fetchConfig } from '../lib/config';
import { generateFilename } from '../lib/Filename';
import type { Filename } from '../lib/Filename';
import {
	WeeklyExporter,
	CaExporter,
	CaHandDeliveryExporter,
	USExporter,
	UpperCaseAddressExporter,
	EuExporter,
} from './WeeklyExporter';
import type { result, Input } from '../exporter';
import getStream from 'get-stream';
import { putValidationError, putRowsProcessed } from '../lib/cloudwatch';

const SUBSCRIPTION_NAME = 'Subscription.Name';
const ADDRESS_1 = 'SoldToContact.Address1';
const CITY = 'SoldToContact.City';
const COUNTRY = 'SoldToContact.Country';
const POSTAL_CODE = 'SoldToContact.PostalCode';
const FIRST_NAME = 'SoldToContact.FirstName';
const LAST_NAME = 'SoldToContact.LastName';
const HOLIDAYS_QUERY_NAME = 'WeeklyHolidaySuspensions';
const SUBSCRIPTIONS_QUERY_NAME = 'WeeklySubscriptions';
const INTRODUCTORY_QUERY_NAME = 'WeeklyIntroductoryPeriods';

async function getDownloadStream(
	results: Array<result>,
	stage: string,
	queryName: string,
): Promise<Readable> {
	function getFileName(queryName: string) {
		function isTargetQuery(result: { queryName: string }) {
			return result.queryName === queryName;
		}

		const filtered = results.filter(isTargetQuery);
		console.log(results, '!');

		if (filtered.length !== 1) {
			return null; // not sure if there are options in js
		} else {
			return filtered[0]?.fileName;
		}
	}

	return new Promise((resolve, reject) => {
		console.log(`getting results file for query: ${queryName}`);
		const fileName = getFileName(queryName);
		if (!fileName) {
			reject(
				new Error(`Invalid input cannot find unique query called ${queryName}`),
			);
			return;
		}
		const path = `zuoraExport/${fileName}`;
		resolve(createReadStream(path));
	});
}

function getHolidaySuspensions(downloadStream: Readable): Promise<Set<string>> {
	return new Promise((resolve, reject) => {
		const suspendedSubs = new Set<string>();
		downloadStream
			.pipe(csv.parse({ headers: true }))
			.on('error', (error) => {
				console.log('Failed to get HolidaySuspensions CSV: ', error);
				reject(error);
			})
			.on('data', (row) => {
				const subName = row['Subscription.Name'];
				suspendedSubs.add(subName);
			})
			.on('end', (rowCount: number) => {
				console.log(`Successfully write ${rowCount} rows`);
				resolve(suspendedSubs);
			});
	});
}

const australiaFulfilmentCountries = [
	'Australia',
	'Japan',
	'Singapore',
	'Thailand',
];

function getFullName(zFirstName: string, zLastName: string) {
	let firstName = zFirstName;
	if (firstName.trim() === '.') {
		firstName = '';
	}
	return [firstName, zLastName].join(' ').trim();
}

/**
 * Transfroms raw CSV from Zuora to expected CSV format, splits it per regions, and uploads it to S3 fulfilments folder.
 * If an exporter is not defined for a specific country, then it defaults to Rest of the world (ROW) fulfilment file.
 * FIXME: Rename fulfilments to something meaningful such as guardian_weekly!
 *
 * @param downloadStream raw Guardian Weekly CSV exported from Zuora
 * @param deliveryDate
 * @param stage
 * @param holidaySuspensions subscriptions to filter out from CSV
 * @returns {Promise<Filename[]>}
 */
async function processSubs(
	downloadStream: MultiStream,
	deliveryDate: Moment,
	stage: string,
	holidaySuspensions: Set<string>,
): Promise<Array<Filename>> {
	const config = await fetchConfig();
	console.log('loaded ' + holidaySuspensions.size + ' holiday suspensions');
	const rowExporter = new WeeklyExporter(
		'Rest of the world',
		deliveryDate,
		config.fulfilments.weekly.ROW.uploadFolder,
	);

	const exporters = [
		new WeeklyExporter(
			'United Kingdom',
			deliveryDate,
			config.fulfilments.weekly.UK.uploadFolder,
		),
		new CaExporter(
			'Canada',
			deliveryDate,
			config.fulfilments.weekly.CA.uploadFolder,
		),
		new CaHandDeliveryExporter(
			'Canada',
			deliveryDate,
			config.fulfilments.weekly.CAHAND.uploadFolder,
		),
		new USExporter(
			'United States',
			deliveryDate,
			config.fulfilments.weekly.US.uploadFolder,
		),
		new UpperCaseAddressExporter(
			australiaFulfilmentCountries,
			deliveryDate,
			config.fulfilments.weekly.AU.uploadFolder,
		),
		new UpperCaseAddressExporter(
			'New Zealand',
			deliveryDate,
			config.fulfilments.weekly.NZ.uploadFolder,
		),
		new UpperCaseAddressExporter(
			'Vanuatu',
			deliveryDate,
			config.fulfilments.weekly.VU.uploadFolder,
		),
		new EuExporter(
			'EU',
			deliveryDate,
			config.fulfilments.weekly.EU.uploadFolder,
		),
		rowExporter,
	];

	// Validation counters for CloudWatch metrics
	let totalRowsProcessed = 0;
	let missingAddressCount = 0;
	let missingCountryCount = 0;
	let missingPostcodeCount = 0;

	const writableCsvPromise: Promise<void> = new Promise((resolve, reject) => {
		downloadStream
			.pipe(csv.parse({ headers: true }))
			.on('error', (error) => {
				console.log('ignoring invalid data: ', error);
				reject(error);
			})
			.on('data', (row) => {
				const subscriptionName = row[SUBSCRIPTION_NAME];
				if (holidaySuspensions.has(subscriptionName)) return;

				totalRowsProcessed++;

				// Validate critical fields (incident-driven)
				const customerName = getFullName(
					row[FIRST_NAME] || '',
					row[LAST_NAME] || '',
				);

				if (!row[ADDRESS_1] || row[ADDRESS_1]?.trim() === '') {
					missingAddressCount++;
					console.warn(
						`VALIDATION ERROR: Missing address | Subscription: ${subscriptionName} | Customer: ${customerName} | City: ${row[CITY] || 'N/A'} | Country: ${row[COUNTRY] || 'N/A'} | Postcode: ${row[POSTAL_CODE] || 'N/A'}`,
					);
				}

				if (!row[COUNTRY] || row[COUNTRY]?.trim() === '') {
					missingCountryCount++;
					console.warn(
						`VALIDATION ERROR: Missing country | Subscription: ${subscriptionName} | Customer: ${customerName} | Address: ${row[ADDRESS_1] || 'N/A'} | City: ${row[CITY] || 'N/A'} | Postcode: ${row[POSTAL_CODE] || 'N/A'}`,
					);
				}

				if (!row[POSTAL_CODE] || row[POSTAL_CODE]?.trim() === '') {
					missingPostcodeCount++;
					console.warn(
						`VALIDATION ERROR: Missing postcode | Subscription: ${subscriptionName} | Customer: ${customerName} | Address: ${row[ADDRESS_1] || 'N/A'} | City: ${row[CITY] || 'N/A'} | Country: ${row[COUNTRY] || 'N/A'}`,
					);
				}

				const selectedExporter =
					exporters.find((exporter) => exporter.useForRow(row)) || rowExporter;
				selectedExporter.processRow(row);
			})
			.on('end', (rowCount: number) => {
				console.log(`Successfully written ${rowCount} rows`);
				exporters.map((exporter) => {
					exporter.end();
				});
				resolve();
			});
	});

	await writableCsvPromise;
	const uploads = exporters.map(async (exporter) => {
		const outputFileName = generateFilename(deliveryDate, 'WEEKLY');
		/**
		 * WARNING: Although AWS S3.upload docs seem to indicate we can upload a stream object directly via
		 * 'Body: stream' params field, it does not seem to work with the stream provided by csv-parser,
		 * thus we had to convert the stream to string using get-stream package.
		 */
		const streamAsString = await getStream(exporter.writeCSVStream);
		await upload(streamAsString, outputFileName, exporter.folder);
		return outputFileName;
	});
	const filenames = await Promise.all(uploads);

	// Publish CloudWatch metrics
	console.log(
		`Publishing metrics: ${totalRowsProcessed} rows processed, ` +
			`${missingAddressCount} missing addresses, ` +
			`${missingCountryCount} missing countries, ` +
			`${missingPostcodeCount} missing postcodes`,
	);
	await putRowsProcessed('weekly', totalRowsProcessed);

	if (missingAddressCount > 0) {
		await putValidationError('MissingStreetAddress', 'weekly', missingAddressCount);
	}
	if (missingCountryCount > 0) {
		await putValidationError('MissingCountry', 'weekly', missingCountryCount);
	}
	if (missingPostcodeCount > 0) {
		await putValidationError('MissingPostcode', 'weekly', missingPostcodeCount);
	}

	return filenames;
}

function getDeliveryDate(input: Input): Promise<Moment> {
	return new Promise((resolve, reject) => {
		const deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD');
		if (deliveryDate.isValid()) {
			resolve(deliveryDate);
		} else {
			reject(new Error('invalid deliverydate expected format YYYY-MM-DD'));
		}
	});
}

export async function weeklyExport(input: Input) {
	const stage = await getStage();
	const deliveryDate = await getDeliveryDate(input);
	const holidaySuspensionsStream = await getDownloadStream(
		input.results,
		stage,
		HOLIDAYS_QUERY_NAME,
	);
	const holidaySuspensions = await getHolidaySuspensions(
		holidaySuspensionsStream,
	);
	const introductoryPeriodStream = await getDownloadStream(
		input.results,
		stage,
		INTRODUCTORY_QUERY_NAME,
	);
	const NonIntroductorySubsStream = await getDownloadStream(
		input.results,
		stage,
		SUBSCRIPTIONS_QUERY_NAME,
	);
	const subscriptionsStream = new MultiStream([
		introductoryPeriodStream,
		NonIntroductorySubsStream,
	]);
	const outputFileNames = await processSubs(
		subscriptionsStream,
		deliveryDate,
		stage,
		holidaySuspensions,
	);
	return outputFileNames.map((f) => f.filename).join();
}
