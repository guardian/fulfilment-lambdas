import { Handler } from 'aws-lambda';
import { fetchConfig } from './lib/config';
import { authenticate } from './lib/salesforceAuthenticator';
import type { Folder, Salesforce } from './lib/salesforceAuthenticator';
import type { S3Folder } from './lib/storage';
import type { Config } from './lib/config';
import { ls, upload } from './lib/storage';

import stream from 'stream';
import getStream from 'get-stream';

export const handler: Handler = async (event, context, callback) => {
	downloader()
		.then((r) => {
			console.log('response:', r);
			console.log('success');
			callback(null, { ...event, ...r });
		})
		.catch((e) => {
			console.log('oh no  ', e);
			callback(e);
		});
};

async function downloader() {
	console.log('Fetching config from S3.');
	const config = await fetchConfig();
	const salesforce = await authenticate(config);
	console.log('Getting home delivery folder');
	const folders: Array<Folder & S3Folder> = [
		config.fulfilments.homedelivery.downloadFolder,
		...Object.keys(config.fulfilments.weekly).map(
			(k) =>
				config.fulfilments.weekly[k as keyof Config['fulfilments']['weekly']]
					.downloadFolder,
		),
	];
	const promises = folders.map((folder) =>
		download(config, salesforce, folder),
	);
	const result = await Promise.all(promises);
	return result.reduce((acc, val) => {
		return { ...acc, ...val };
	}, {});
}

async function download(
	config: Config,
	salesforce: Salesforce,
	folder: Folder & S3Folder,
) {
	console.log('Fetching existing files in S3: ', folder.bucket, folder.prefix);
	const contents = await ls(folder);
	const keys =
		contents?.map((r) => {
			return r.Key?.slice(folder.prefix.length);
		}) || [];
	console.log('Ignoring existing files:', keys);

	console.log('Fetching file list from Saleforce.');
	const documents = await salesforce.getDocuments(folder);
	const filtered = documents.filter((d: { Name: string }) => {
		return !keys.includes(d.Name);
	});

	const uploads = filtered.map(
		async (doc: { Name: string; attributes: { url: string } }) => {
			console.log('Starting download of ', doc.Name);
			const dl = await salesforce.getStream(`${doc.attributes.url}/Body`);
			const st = new stream.PassThrough();
			dl.pipe(st);
			console.log('Starting upload to S3 ');
			const streamAsString = await getStream(st);
			return upload(streamAsString, doc.Name, folder);
		},
	);
	console.log('Performing upload/downloads.');
	const status = await Promise.all(uploads);
	return { [folder.name]: status.map((s) => s.key) };
}
