import axios from 'axios';
import FormData from 'form-data';
import type { Config } from './config';
import NamedError from './NamedError';
import { S3 } from 'aws-sdk';

export type Folder = {
	folderId: string;
	name: string;
};

export async function authenticate(config: Config) {
	console.log('Authenticating with Salesforce.');

	const url = `https://${config.salesforce.api.salesforceUrl}/services/oauth2/token`;
	const params = new URLSearchParams({
		grant_type: 'password',
		client_id: config.salesforce.api.consumer_key,
		client_secret: config.salesforce.api.consumer_secret,
		username: config.salesforce.api.username,
		password: `${config.salesforce.api.password}${config.salesforce.api.token}`,
	});
	const response = await axios.post(url, params);
	return new Salesforce(response.data.instance_url, response.data.access_token);
}

export class Salesforce {
	url: string;
	headers: Record<string, string>;
	constructor(url: string, token: string) {
		this.url = url;
		this.headers = { Authorization: `Bearer ${token}` };
	}

	getStream(endpoint: string) {
		return axios
			.get(`${this.url}${endpoint}`, {
				headers: this.headers,
				responseType: 'stream',
			})
			.then((response) => response.data);
	}

	async get(endpoint: string) {
		const response = await axios.get(`${this.url}${endpoint}`, {
			headers: this.headers,
		});
		return JSON.stringify(response.data);
	}

	async post(endpoint: string, form: { [key: string]: unknown }) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(form)) {
			if (
				typeof value === 'object' &&
				value !== null &&
				'value' in value &&
				'options' in value
			) {
				const v = value as {
					value: unknown;
					options: { contentType: string; filename?: string };
				};
				formData.append(key, v.value as any, v.options);
			} else {
				formData.append(key, value as any);
			}
		}
		const response = await axios.post(`${this.url}${endpoint}`, formData, {
			headers: {
				...this.headers,
				...formData.getHeaders(),
			},
		});
		return JSON.stringify(response.data);
	}

	async uploadDocument(
		path: string,
		folder: Folder,
		description: string,
		body?: S3.Body,
	) {
		// build a little json
		const message = {
			Description: description,
			Keywords: 'fulfilment',
			FolderId: folder.folderId,
			Name: path,
			Type: 'csv',
		};

		// don't try to make the form with a stream from s3 or by appending form sections
		const form = {
			entity_document: {
				value: JSON.stringify(message),
				options: {
					contentType: 'application/json',
				},
			},
			Body: {
				value: body,
				options: { contentType: 'text/csv', filename: path },
			},
		};

		const url = '/services/data/v54.0/sobjects/Document/'; // NOT FOR UPDATING
		const uploadResult = await this.post(url, form);
		const parsed = JSON.parse(uploadResult);

		if (parsed.id == null) {
			throw new NamedError('Upload failed', 'Upload did not return an id');
		}
		const id = parsed.id;
		return {
			id: id,
			url: `${this.url}/${id}`,
		};
	}

	async getDocuments(folderId: Folder) {
		const response = await this.get(
			`/services/data/v54.0/query?q=SELECT Id, Name FROM Document WHERE FolderId= '${folderId.folderId}'`,
		);
		if (response == null) {
			throw new Error(
				`Failed to parse salesforce attempt when listing folder ${folderId.name} (${folderId.folderId}) contents.`,
			);
		}
		const j = JSON.parse(response);
		console.log(j);
		if (j == null || j.records == null) {
			throw new Error('No records received from Salesforce');
		}
		return j.records; // Todo: make this return an [document]
	}
}
