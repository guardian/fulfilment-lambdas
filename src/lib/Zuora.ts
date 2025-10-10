import type { Config } from './config';
import axios from 'axios';
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
	data: Buffer;
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

	async query(name: string, ...queries: Array<Query>) {
		const exportQueries = queries.map((q) => {
			return { ...q, type: 'zoqlexport' };
		});
		try {
			const response = await axios.post(
				`${this.config.zuora.api.url}/apps/api/batch-query/`,
				{
					format: 'csv',
					version: '1.0',
					name: 'Fulfilment-Queries',
					encrypted: 'none',
					useQueryLabels: 'true',
					dateTimeUtc: 'true',
					queries: exportQueries,
				},
				{
					headers: {
						...this.authorization,
						'Content-Type': 'application/json',
					},
				},
			);

			console.log('statusCode:', response.status);

			if (response.data.errorCode) {
				console.log(
					`zuora error! code: ${response.data.errorCode} : ${response.data.message}`,
				);
				throw new NamedError(
					'api_call_error',
					`zuora error! code: ${response.data.errorCode} : ${response.data.message}`,
				);
			}

			console.log('jobId: ', response.data.id);
			return response.data.id;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				console.log(`error response status ${error.response.status}`);
				throw new NamedError(
					'api_call_error',
					`error response status ${error.response.status}`,
				);
			}
			throw error;
		}
	}

	async fetchFile(batch: Batch, deliveryDate: string): Promise<FileData> {
		console.log(`fetching file from zuora with id ${batch.fileId}`);
		try {
			const response = await axios.get(
				`${this.config.zuora.api.url}/apps/api/batch-query/file/${batch.fileId}`,
				{
					headers: {
						...this.authorization,
						'Content-Type': 'application/json',
					},
					responseType: 'arraybuffer',
				},
			);

			// TODO SEE HOW TO DETECT FAILURES OR ANY OTHER SPECIAL CASE HERE
			const fileData = {
				batchName: batch.name,
				fileName: `${batch.name}_${deliveryDate}_${batch.fileId}.csv`,
				data: Buffer.from(response.data),
			};
			return fileData;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				throw new NamedError(
					'api_call_error',
					`error response status ${error.response.status} when getting batch ${batch.name}`,
				);
			}
			throw new NamedError('api_call_error', JSON.stringify(error));
		}
	}

	async getJobResult(jobId: string): Promise<Array<Batch>> {
		console.log(`getting job results for jobId=${jobId}`);
		try {
			const response = await axios.get(
				`${this.config.zuora.api.url}/apps/api/batch-query/jobs/${jobId}`,
				{
					headers: {
						...this.authorization,
						'Content-Type': 'application/json',
					},
				},
			);

			console.log('Job result received.');
			const body = response.data;

			if (body.status !== 'completed') {
				if (body.status !== 'error' && body.status !== 'aborted') {
					throw new NamedError(
						'zuora_job_pending',
						`job status was ${body.status} api call should be retried later`,
					);
				} else {
					throw new NamedError(
						'api_call_error',
						`job status was ${body.status} expected completed`,
					);
				}
			}

			// TODO SEE HOW TO DETECT FAILURES OR ANY OTHER SPECIAL CASE HERE
			const notCompleted = body.batches
				.filter((batch: Batch) => batch.status !== 'completed')
				.map((batch: Batch) => `${batch.name} is in status: ${batch.status}`);
			if (notCompleted.length > 1) {
				throw new NamedError('batch_not_completed', notCompleted.join());
			}
			return body.batches;
		} catch (error) {
			if (axios.isAxiosError(error) && error.response) {
				throw new NamedError(
					'api_call_error',
					`error response status ${error.response.status} while getting job result`,
				);
			}
			throw error;
		}
	}
}
