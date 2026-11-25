import AWS from 'aws-sdk';
import {
	authenticate,
	buildSalesforceAuthBody,
	parseSalesforceCredentials,
} from '../../src/lib/salesforceAuthenticator';

const credentials = {
	authUrl: 'https://example.my.salesforce.com/services/oauth2/token',
	clientId: 'id',
	clientSecret: 'value',
};

function secretsManagerReturning(secret: unknown): AWS.SecretsManager {
	return {
		getSecretValue: jest.fn().mockReturnValue({
			promise: jest.fn().mockResolvedValue({
				SecretString: JSON.stringify(secret),
			}),
		}),
	} as unknown as AWS.SecretsManager;
}

describe('Salesforce credentials', () => {
	it('parses the connected app secret', () => {
		expect(parseSalesforceCredentials(credentials)).toEqual(credentials);
	});

	it.each([
		undefined,
		null,
		{},
		{ ...credentials, authUrl: '' },
		{ ...credentials, clientId: ' ' },
		{ ...credentials, clientSecret: undefined },
	])('rejects an invalid connected app secret', (secret) => {
		expect(() => parseSalesforceCredentials(secret)).toThrow(
			'Salesforce connected app secret must contain non-empty authUrl, clientId and clientSecret fields',
		);
	});

	it('builds a client credentials request without username or password fields', () => {
		const body = buildSalesforceAuthBody(credentials);

		expect(body.get('grant_type')).toBe('client_credentials');
		expect(body.get('client_id')).toBe(credentials.clientId);
		expect(body.get('client_secret')).toBe(credentials.clientSecret);
		expect(body.has('username')).toBe(false);
		expect(body.has('password')).toBe(false);
	});
});

describe('authenticate', () => {
	const originalSecretName = process.env.SECRET_NAME_CONNECTED_APP;

	afterEach(() => {
		jest.restoreAllMocks();
		if (originalSecretName === undefined) {
			delete process.env.SECRET_NAME_CONNECTED_APP;
		} else {
			process.env.SECRET_NAME_CONNECTED_APP = originalSecretName;
		}
	});

	it('loads the configured secret and authenticates with Salesforce', async () => {
		process.env.SECRET_NAME_CONNECTED_APP =
			'CODE/Salesforce/ConnectedApp/PrintFulfilment';
		const secretsManager = secretsManagerReturning(credentials);
		const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
			new Response(
				JSON.stringify({
					instance_url: 'https://example.my.salesforce.com',
					access_token: 'token',
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			),
		);

		const salesforce = await authenticate(secretsManager);

		expect(secretsManager.getSecretValue).toHaveBeenCalledWith({
			SecretId: 'CODE/Salesforce/ConnectedApp/PrintFulfilment',
			VersionStage: 'AWSCURRENT',
		});
		expect(fetchMock).toHaveBeenCalledWith(credentials.authUrl, {
			method: 'POST',
			body: expect.any(URLSearchParams),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});
		const request = fetchMock.mock.calls[0]?.[1];
		expect((request?.body as URLSearchParams).toString()).toBe(
			'grant_type=client_credentials&client_id=id&client_secret=value',
		);
		expect(salesforce.url).toBe('https://example.my.salesforce.com');
		expect(salesforce.headers).toEqual({
			Authorization: 'Bearer token',
		});
	});

	it('fails before reading Secrets Manager when the secret name is missing', async () => {
		delete process.env.SECRET_NAME_CONNECTED_APP;
		const secretsManager = secretsManagerReturning(credentials);

		await expect(authenticate(secretsManager)).rejects.toThrow(
			'SECRET_NAME_CONNECTED_APP is not configured',
		);
		expect(secretsManager.getSecretValue).not.toHaveBeenCalled();
	});

	it('reports a Salesforce authentication failure without exposing the response', async () => {
		process.env.SECRET_NAME_CONNECTED_APP =
			'CODE/Salesforce/ConnectedApp/PrintFulfilment';
		const fetchMock = jest
			.spyOn(global, 'fetch')
			.mockResolvedValue(new Response('', { status: 401 }));

		await expect(
			authenticate(secretsManagerReturning(credentials)),
		).rejects.toThrow('Authentication failed with status 401');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
