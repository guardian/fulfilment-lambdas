import FormData from 'form-data';
import NamedError from './NamedError';
import AWS, { S3 } from 'aws-sdk';
import { Readable, PassThrough } from 'stream';

export type Folder = {
	folderId: string;
	name: string;
};

export type SalesforceCredentials = {
	authUrl: string;
	clientId: string;
	clientSecret: string;
};

type SalesforceAuthResponse = {
	instance_url: string;
	access_token: string;
};

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export function parseSalesforceCredentials(
	secret: unknown,
): SalesforceCredentials {
	if (
		typeof secret !== 'object' ||
		secret === null ||
		!('authUrl' in secret) ||
		!isNonEmptyString(secret.authUrl) ||
		!('clientId' in secret) ||
		!isNonEmptyString(secret.clientId) ||
		!('clientSecret' in secret) ||
		!isNonEmptyString(secret.clientSecret)
	) {
		throw new Error(
			'Salesforce connected app secret must contain non-empty authUrl, clientId and clientSecret fields',
		);
	}

	return {
		authUrl: secret.authUrl,
		clientId: secret.clientId,
		clientSecret: secret.clientSecret,
	};
}

export function buildSalesforceAuthBody(
	credentials: SalesforceCredentials,
): URLSearchParams {
	return new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: credentials.clientId,
		client_secret: credentials.clientSecret,
	});
}

async function getSalesforceCredentials(
	secretName: string,
	secretsManager: AWS.SecretsManager,
): Promise<SalesforceCredentials> {
	const response = await secretsManager
		.getSecretValue({
			SecretId: secretName,
			VersionStage: 'AWSCURRENT',
		})
		.promise();

	if (response.SecretString === undefined) {
		throw new Error(`Secret ${secretName} has no string value`);
	}

	return parseSalesforceCredentials(
		JSON.parse(response.SecretString) as unknown,
	);
}

function getSalesforceSecretName(): string {
	const secretName = process.env.SECRET_NAME_CONNECTED_APP;
	if (!secretName) {
		throw new Error('SECRET_NAME_CONNECTED_APP is not configured');
	}
	return secretName;
}

function parseSalesforceAuthResponse(
	response: unknown,
): SalesforceAuthResponse {
	if (
		typeof response !== 'object' ||
		response === null ||
		!('instance_url' in response) ||
		!isNonEmptyString(response.instance_url) ||
		!('access_token' in response) ||
		!isNonEmptyString(response.access_token)
	) {
		throw new Error(
			'Salesforce authentication response is missing instance_url or access_token',
		);
	}

	return {
		instance_url: response.instance_url,
		access_token: response.access_token,
	};
}

export async function authenticate(secretsManager = new AWS.SecretsManager()) {
	const credentials = await getSalesforceCredentials(
		getSalesforceSecretName(),
		secretsManager,
	);
	const response = await fetch(credentials.authUrl, {
		method: 'POST',
		body: buildSalesforceAuthBody(credentials),
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
	});

	if (!response.ok) {
		throw new Error(`Authentication failed with status ${response.status}`);
	}

	const data = parseSalesforceAuthResponse(await response.json());
	return new Salesforce(data.instance_url, data.access_token);
}

export class Salesforce {
	url: string;
	headers: Record<string, string>;
	constructor(url: string, token: string) {
		this.url = url;
		this.headers = { Authorization: `Bearer ${token}` };
	}

	async getStream(endpoint: string) {
		const response = await fetch(`${this.url}${endpoint}`, {
			headers: this.headers,
		});

		if (!response.ok) {
			throw new Error(
				`Failed to get stream from ${endpoint}: ${response.status}`,
			);
		}

		if (!response.body) {
			throw new Error(`No response body from ${endpoint}`);
		}

		// Convert Web ReadableStream to Node.js Readable stream
		return Readable.fromWeb(response.body as any);
	}

	async get(endpoint: string) {
		const response = await fetch(`${this.url}${endpoint}`, {
			headers: this.headers,
		});

		if (!response.ok) {
			throw new Error(`GET request failed: ${response.status}`);
		}

		const data = await response.json();
		return JSON.stringify(data);
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

		// Convert FormData stream to Buffer for fetch (form-data npm package is stream-based)
		// Pipe through PassThrough to properly consume the stream
		const passthrough = new PassThrough();
		formData.pipe(passthrough);

		const buffer = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			passthrough.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
			passthrough.on('end', () => resolve(Buffer.concat(chunks)));
			passthrough.on('error', reject);
		});

		const response = await fetch(`${this.url}${endpoint}`, {
			method: 'POST',
			headers: {
				...this.headers,
				...formData.getHeaders(),
			},
			body: buffer,
		});

		if (!response.ok) {
			throw new Error(`POST request failed: ${response.status}`);
		}

		const data = await response.json();
		return JSON.stringify(data);
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
