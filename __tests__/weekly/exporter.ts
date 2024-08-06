/* eslint-env jest */
import { handler, Input } from '../../src/exporter';
var MockDate = require('mockdate');

// mock current date
MockDate.set('7/5/2017');

jest.mock('../../src/lib/storage', () => {
	const fs = require('fs');

	return {
		upload: async (stringSource: string, outputLocation: string) =>
			outputLocation,
		createReadStream: async (filePath: string) => {
			const testFilePath = `./__tests__/resources/${filePath}`;
			console.log(`loading test file ${testFilePath} ...`);
			return fs.createReadStream(testFilePath);
		},
	};
});

jest.mock('../../src/lib/config', () => ({
	getStage: () => 'CODE',
	fetchConfig: async () => ({
		fulfilments: {
			weekly: {
				VU: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_VU',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_VU/',
					},
					downloadFolder: {
						folderId: 'folderId1',
						name: 'Guardian Weekly (Vanuatu)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/vu/',
					},
				},
				HK: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_HK',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_HK/',
					},
					downloadFolder: {
						folderId: 'folderId2',
						name: 'Guardian Weekly (Hong Kong)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/hk/',
					},
				},
				ROW: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_ROW',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_ROW/',
					},
					downloadFolder: {
						folderId: 'folderId3',
						name: 'Guardian Weekly (Rest of tge World)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/row/',
					},
				},
				AU: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_AU',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_AU/',
					},
					downloadFolder: {
						folderId: 'folderId4',
						name: 'Guardian Weekly (Australia)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/au/',
					},
				},
				US: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_US',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_US/',
					},
					downloadFolder: {
						folderId: '00l0J000002OrHhQAK',
						name: 'Guardian Weekly (USA)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/usa/',
					},
				},
				EU: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_EU',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_EU/',
					},
					downloadFolder: {
						folderId: 'folderId5',
						name: 'Guardian Weekly (EU)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/eu/',
					},
				},
				NZ: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_NZ',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_NZ/',
					},
					downloadFolder: {
						folderId: 'folderId6',
						name: 'Guardian Weekly (New Zealand)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/nz/',
					},
				},
				UK: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_UK',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_UK/',
					},
					downloadFolder: {
						folderId: 'folderId7',
						name: 'Guardian Weekly (UK)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/uk/',
					},
				},
				CAHAND: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_CA_HAND',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_CA_HAND/',
					},
					downloadFolder: {
						folderId: 'folderId8',
						name: 'Guardian Weekly (canada hand delivery)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/ca_hand/',
					},
				},
				CA: {
					uploadFolder: {
						folderId: null,
						name: 'Weekly_Pipeline_CA',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_CA/',
					},
					downloadFolder: {
						folderId: 'folderId19',
						name: 'Guardian Weekly (Canada)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/ca/',
					},
				},
			},
		},
	}),
}));

beforeEach(() => {
	process.env.Stage = 'CODE';
});

it('should return error on missing query subscriptions query result for weekly', async () => {
	const input: Input = {
		type: 'weekly',
		deliveryDate: '2017-07-06',
		results: [
			{
				queryName: 'WeeklyHolidaySuspensions',
				fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv',
			},
			{
				queryName: 'WeeklyIntroductoryPeriods',
				fileName: 'WeeklyIntroductoryPeriods_2017-07-06.csv',
			},
		],
	};
	await expect(handler(input)).rejects.toThrow();
});

it('should return error on invalid deliveryDate for weekly', async () => {
	const input: Input = {
		type: 'weekly',
		deliveryDate: '2017-14-06',
		results: [
			{
				queryName: 'WeeklySubscriptions',
				fileName: 'WeeklySubscriptions_2017-07-06.csv',
			},
			{
				queryName: 'WeeklyHolidaySuspensions',
				fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv',
			},
			{
				queryName: 'WeeklyIntroductoryPeriods',
				fileName: 'WeeklyIntroductoryPeriods_2017-07-06.csv',
			},
		],
	};
	await expect(handler(input)).rejects.toThrow();
});

it('should generate correct fulfilment file for weekly', async () => {
	const input: Input = {
		type: 'weekly',
		deliveryDate: '2017-07-06',
		results: [
			{
				queryName: 'WeeklySubscriptions',
				fileName: 'WeeklySubscriptions_2017-07-06.csv',
			},
			{
				queryName: 'WeeklyHolidaySuspensions',
				fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv',
			},
			{
				queryName: 'WeeklyIntroductoryPeriods',
				fileName: 'WeeklyIntroductoryPeriods_2017-07-06.csv',
			},
		],
	};

	const expectedResponse = {
		...input,
		fulfilmentFile:
			'2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv',
	};
	await expect(handler(input)).resolves.toEqual(expectedResponse);
});
