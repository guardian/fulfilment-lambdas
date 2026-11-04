/* eslint-env jest */

import type { Config } from '../../src/lib/config';
import { Zuora } from '../../src/lib/Zuora';

const config = {
	stage: 'CODE',
	zuora: {
		api: {
			url: 'https://apisandbox.zuora.com',
			oauthUrl: 'https://rest.apisandbox.zuora.com',
			clientId: 'client-id',
			clientSecret: 'client-secret',
		},
	},
} as Config;

const response = (body: unknown, ok = true, status = 200) => ({
	ok,
	status,
	json: () => Promise.resolve(body),
});

beforeEach(() => {
	global.fetch = jest.fn();
});

test('uses an OAuth bearer token for Zuora requests', async () => {
	const fetchMock = global.fetch as jest.Mock;
	fetchMock
		.mockResolvedValueOnce(
			response({ access_token: 'token', expires_in: 3600 }),
		)
		.mockResolvedValueOnce(response({ id: 'job-id' }));

	const zuora = new Zuora(config);
	await expect(zuora.query('query')).resolves.toBe('job-id');

	expect(fetchMock).toHaveBeenNthCalledWith(
		1,
		'https://rest.apisandbox.zuora.com/oauth/token',
		expect.objectContaining({
			method: 'POST',
			body: expect.any(URLSearchParams),
		}),
	);
	const tokenRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
	const tokenRequestBody = new URLSearchParams(tokenRequest.body?.toString());
	expect(tokenRequestBody.get('client_id')).toBe(config.zuora.api.clientId);
	expect(tokenRequestBody.get('client_secret')).toBe(
		config.zuora.api.clientSecret,
	);
	expect(tokenRequestBody.get('grant_type')).toBe('client_credentials');
	expect(fetchMock).toHaveBeenNthCalledWith(
		2,
		'https://apisandbox.zuora.com/apps/api/batch-query/',
		expect.objectContaining({
			headers: expect.objectContaining({
				Authorization: 'Bearer token',
			}),
		}),
	);
});

test('reuses a valid OAuth token', async () => {
	const fetchMock = global.fetch as jest.Mock;
	fetchMock
		.mockResolvedValueOnce(
			response({ access_token: 'token', expires_in: 3600 }),
		)
		.mockResolvedValueOnce(response({ id: 'first-job-id' }))
		.mockResolvedValueOnce(response({ id: 'second-job-id' }));

	const zuora = new Zuora(config);
	await zuora.query('first query');
	await zuora.query('second query');

	expect(fetchMock).toHaveBeenCalledTimes(3);
	expect(
		fetchMock.mock.calls.filter(([url]) =>
			url.toString().endsWith('/oauth/token'),
		),
	).toHaveLength(1);
});

test('refreshes an expired OAuth token', async () => {
	const fetchMock = global.fetch as jest.Mock;
	fetchMock
		.mockResolvedValueOnce(response({ access_token: 'expired', expires_in: 0 }))
		.mockResolvedValueOnce(response({ id: 'first-job-id' }))
		.mockResolvedValueOnce(
			response({ access_token: 'new-token', expires_in: 3600 }),
		)
		.mockResolvedValueOnce(response({ id: 'second-job-id' }));

	const zuora = new Zuora(config);
	await zuora.query('first query');
	await zuora.query('second query');

	expect(fetchMock).toHaveBeenCalledTimes(4);
	expect(fetchMock.mock.calls[3]?.[1]).toEqual(
		expect.objectContaining({
			headers: expect.objectContaining({
				Authorization: 'Bearer new-token',
			}),
		}),
	);
});

test('fails when the OAuth token request is rejected', async () => {
	const fetchMock = global.fetch as jest.Mock;
	fetchMock.mockResolvedValueOnce(response({}, false, 401));

	const zuora = new Zuora(config);
	await expect(zuora.query('query')).rejects.toThrow(
		'error response status 401 when fetching oauth token',
	);
});
