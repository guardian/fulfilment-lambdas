// @flow
import AWS from 'aws-sdk';
import NamedError from './NamedError';
import type { Folder } from './salesforceAuthenticator';
import type { S3Folder } from './storage';

const s3 = new AWS.S3();

export type Stage = 'CODE' | 'PROD';
const stages: Array<Stage> = ['CODE', 'PROD'];
export type fulfilmentType = 'homedelivery' | 'weekly';

export type uploadDownload = {
	uploadFolder: Folder & S3Folder,
	downloadFolder: Folder & S3Folder,
};
export type Config = {
	stage: Stage,
	zuora: {
		api: {
			url: string,
			username: string,
			password: string,
		},
	},
	salesforce: {
		api: {
			consumer_key: string,
			consumer_secret: string,
			username: string,
			password: string,
			token: string,
			salesforceUrl: string,
		},
	},
	api: {
		expectedToken: string,
	},
	fulfilments: {
		homedelivery: uploadDownload,
		weekly: {
			NZ: uploadDownload,
			VU: uploadDownload,
			AU: uploadDownload,
			UK: uploadDownload,
			CA: uploadDownload,
			CAHAND: uploadDownload,
			US: uploadDownload,
			EU: uploadDownload,
			ROW: uploadDownload,
		},
	},
};

export function getStage(): Promise<Stage> {
	return new Promise((resolve, reject) => {
		const stage = stages.find((stage) => {
			return stage === process.env.Stage;
		});
		if (stage) {
			resolve(stage);
		} else {
			reject(
				new Error(
					`invalid stage: ${process.env.Stage || 'not found'}, please fix Stage env variable`,
				),
			);
		}
	});
}

function fetchConfigForStage(stage: Stage): Promise<Config> {
	console.log('Fetching configuration file from S3.');
	return new Promise((resolve, reject) => {
		const key = 'fulfilment.private.json';
		const bucket = `gu-reader-revenue-private/membership/fulfilment-lambdas/${stage}`;
		console.log(`loading ${stage} configuration from ${bucket}/${key}`);

		s3.getObject({ Bucket: bucket, Key: key }, function (err, data) {
			if (err) {
				console.log(`Error fetching config for S3 : ${err}`);
				reject(
					new NamedError(
						'config_error',
						`Error fetching config for S3 : ${err}`,
					),
				);
			} else {
				const json = JSON.parse(Buffer.from(data.Body).toString());
				console.log('Config succesfully downloaded and parsed.');
				resolve({
					stage: stage,
					...json,
				});
			}
		});
	});
}

export function fetchConfig(): Promise<Config> {
	return getStage().then(fetchConfigForStage);
}
