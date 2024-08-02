import type { Config } from './config';
import NamedError from './NamedError';

export type Query = {
	name: string;
	query: string;
};

type Batch = {
	name: string;
	status: string;
	fileId: string;
};

export type FileData = {
	batchName: string;
	fileName: string;
	data: string;
};

export class Zuora {
	authorization: { Authorization: string };
	config: Config;
	constructor(config: Config) {
		this.authorization = {
			Authorization:
				'Basic ' +
				Buffer.from(
					`${config.zuora.api.username}:${config.zuora.api.password}`,
				).toString('base64'),
		};
		this.config = config;
	}

	async query(name: string, ...queries: Array<Query>): Promise<string> {
		const exportQueries = queries.map((q) => {
			return { ...q, type: 'zoqlexport' };
		});

		const response = await fetch(
			`${this.config.zuora.api.url}/apps/api/batch-query/`,
			{
				method: 'POST',
				headers: {
					...this.authorization,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					format: 'csv',
					version: '1.0',
					name: 'Fulfilment-Queries',
					encrypted: 'none',
					useQueryLabels: 'true',
					dateTimeUtc: 'true',
					queries: exportQueries,
				}),
			},
		);

		console.log(response && response.status);

		const json = (await response.json()) as {
			id: string;
			errorCode: string;
			message: string;
		};

		if (response.status !== 200) {
			console.log(`error response status ${response.status}`);
			throw new NamedError(
				'api_call_error',
				`error response status ${response.status}`,
			);
		} else if (json.errorCode) {
			console.log(`zuora error! code: ${json.errorCode} : ${json.message}`);
			throw new NamedError(
				'api_call_error',
				`zuora error! code: ${json.errorCode} : ${json.message}`,
			);
		} else {
			console.log('jobId: ', json.id);
			return json.id;
		}
	}

	async fetchFile(batch: Batch, deliveryDate: string): Promise<FileData> {
		const response = await fetch(
			`${this.config.zuora.api.url}/apps/api/batch-query/file/${batch.fileId}`,
			{
				method: 'GET',
				headers: {
					...this.authorization,
					'Content-Type': 'application/json',
				},
			},
		);

		console.log(response && response.status);

		const text = await response.text();

		if (response.status !== 200) {
			throw new NamedError(
				'api_call_error',
				`error response status ${response.status} when getting batch ${batch.name}`,
			);
		} else {
			// TODO SEE HOW TO DETECT FAILURES OR ANY OTHER SPECIAL CASE HERE
			const fileData = {
				batchName: batch.name,
				fileName: `${batch.name}_${deliveryDate}_${batch.fileId}.csv`,
				data: text,
			};
			return fileData;
		}
	}

	async getJobResult(jobId: string): Promise<Array<Batch>> {
		const response = await fetch(
			`${this.config.zuora.api.url}/apps/api/batch-query/jobs/${jobId}`,
			{
				method: 'GET',
				headers: {
					...this.authorization,
					'Content-Type': 'application/json',
				},
			},
		);

		const json = (await response.json()) as {
			status: string;
			batches: Batch[];
		};

		if (response.status !== 200) {
			throw new NamedError(
				'api_call_error',
				`error response status ${response.status} while getting job result`,
			);
		} else if (json.status !== 'completed') {
			if (json.status !== 'error' && json.status !== 'aborted') {
				throw new NamedError(
					'zuora_job_pending',
					'`job status was ${json.status} api call should be retried later`',
				);
			} else {
				throw new NamedError(
					'api_call_error',
					'`job status was ${json.status} expected completed`',
				);
			}
		} else {
			// TODO SEE HOW TO DETECT FAILURES OR ANY OTHER SPECIAL CASE HERE
			const notCompleted = json.batches
				.filter((batch: Batch) => batch.status !== 'completed')
				.map((batch: Batch) => `${batch.name} is in status: ${batch.status}`);

			if (notCompleted.length > 1) {
				throw new NamedError('batch_not_completed', notCompleted.join());
			}

			return json.batches;
		}
	}
}
