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

type AccessToken = {
	value: string;
	expiresAt: number;
};

export type FileData = {
	batchName: string;
	fileName: string;
	data: Buffer;
};

export class Zuora {
	private readonly config: Pick<Config, 'zuora'>;
	private accessToken?: AccessToken;
	private readonly tokenExpiryBufferMs = 60 * 1000;

	constructor(config: Pick<Config, 'zuora'>) {
		this.config = config;
	}

	private async getAuthorization(): Promise<{ Authorization: string }> {
		if (
			!this.accessToken ||
			this.accessToken.expiresAt <= Date.now() + this.tokenExpiryBufferMs
		) {
			this.accessToken = await this.fetchAccessToken();
		}

		return { Authorization: `Bearer ${this.accessToken.value}` };
	}

	private async fetchAccessToken(): Promise<AccessToken> {
		const formData = new URLSearchParams([
			['client_id', this.config.zuora.api.clientId],
			['client_secret', this.config.zuora.api.clientSecret],
			['grant_type', 'client_credentials'],
		]);
		const response = await fetch(
			`${this.config.zuora.api.oauthUrl}/oauth/token`,
			{
				method: 'POST',
				body: formData,
			},
		);

		if (!response.ok) {
			throw new NamedError(
				'api_call_error',
				`error response status ${response.status} when fetching oauth token`,
			);
		}

		const body = (await response.json()) as {
			access_token?: unknown;
			expires_in?: unknown;
		};
		if (
			typeof body.access_token !== 'string' ||
			typeof body.expires_in !== 'number'
		) {
			throw new NamedError(
				'api_call_error',
				'invalid response when fetching oauth token',
			);
		}

		return {
			value: body.access_token,
			expiresAt: Date.now() + body.expires_in * 1000,
		};
	}

	async query(name: string, ...queries: Array<Query>) {
		const exportQueries = queries.map((q) => {
			return { ...q, type: 'zoqlexport' };
		});
		try {
			const authorization = await this.getAuthorization();
			const response = await fetch(
				`${this.config.zuora.api.url}/apps/api/batch-query/`,
				{
					method: 'POST',
					headers: {
						...authorization,
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

			console.log('statusCode:', response.status);

			if (!response.ok) {
				console.log(`error response status ${response.status}`);
				throw new NamedError(
					'api_call_error',
					`error response status ${response.status}`,
				);
			}

			const data = (await response.json()) as {
				errorCode?: string;
				message?: string;
				id: string;
			};

			if (data.errorCode) {
				console.log(`zuora error! code: ${data.errorCode} : ${data.message}`);
				throw new NamedError(
					'api_call_error',
					`zuora error! code: ${data.errorCode} : ${data.message}`,
				);
			}

			console.log('jobId: ', data.id);
			return data.id;
		} catch (error) {
			if (error instanceof NamedError) {
				throw error;
			}
			throw error;
		}
	}

	async fetchFile(batch: Batch, deliveryDate: string): Promise<FileData> {
		console.log(`fetching file from zuora with id ${batch.fileId}`);
		try {
			const authorization = await this.getAuthorization();
			const response = await fetch(
				`${this.config.zuora.api.url}/apps/api/batch-query/file/${batch.fileId}`,
				{
					headers: {
						...authorization,
						'Content-Type': 'application/json',
					},
				},
			);

			if (!response.ok) {
				throw new NamedError(
					'api_call_error',
					`error response status ${response.status} when getting batch ${batch.name}`,
				);
			}

			const arrayBuffer = await response.arrayBuffer();

			// TODO SEE HOW TO DETECT FAILURES OR ANY OTHER SPECIAL CASE HERE
			const fileData = {
				batchName: batch.name,
				fileName: `${batch.name}_${deliveryDate}_${batch.fileId}.csv`,
				data: Buffer.from(arrayBuffer),
			};
			return fileData;
		} catch (error) {
			if (error instanceof NamedError) {
				throw error;
			}
			throw new NamedError('api_call_error', JSON.stringify(error));
		}
	}

	async getJobResult(jobId: string): Promise<Array<Batch>> {
		console.log(`getting job results for jobId=${jobId}`);
		try {
			const authorization = await this.getAuthorization();
			const response = await fetch(
				`${this.config.zuora.api.url}/apps/api/batch-query/jobs/${jobId}`,
				{
					headers: {
						...authorization,
						'Content-Type': 'application/json',
					},
				},
			);

			if (!response.ok) {
				throw new NamedError(
					'api_call_error',
					`error response status ${response.status} while getting job result`,
				);
			}

			console.log('Job result received.');
			const body = (await response.json()) as {
				status: string;
				batches: Array<Batch>;
			};

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
			if (error instanceof NamedError) {
				throw error;
			}
			throw error;
		}
	}
}
