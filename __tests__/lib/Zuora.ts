/* eslint-env jest */

import { Zuora } from '../../src/lib/Zuora';

const config = {
	zuora: {
		api: {
			url: 'https://apisandbox.zuora.com',
			oauthUrl: 'https://rest.apisandbox.zuora.com',
			clientId: 'client-id',
			clientSecret: 'client-secret',
		},
	},
};

const response = (body: unknown, ok = true, status = 200) => ({
	ok,
	status,
	json: () => Promise.resolve(body),
});

const fileResponse = (body: string) => ({
	ok: true,
	status: 200,
	arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
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

test('fails when the OAuth token response is invalid', async () => {
	const fetchMock = global.fetch as jest.Mock;
	fetchMock.mockResolvedValueOnce(response({ access_token: 'token' }));

	const zuora = new Zuora(config);
	await expect(zuora.query('query')).rejects.toThrow(
		'invalid response when fetching oauth token',
	);
});

test('reuses the OAuth token when polling and downloading a job', async () => {
	const fetchMock = global.fetch as jest.Mock;
	const batch = {
		name: 'subscriptions',
		status: 'completed',
		fileId: 'file-id',
	};
	fetchMock
		.mockResolvedValueOnce(
			response({ access_token: 'token', expires_in: 3600 }),
		)
		.mockResolvedValueOnce(response({ status: 'completed', batches: [batch] }))
		.mockResolvedValueOnce(fileResponse('subscription-number\nA-S000001'));

	const zuora = new Zuora(config);
	await expect(zuora.getJobResult('job-id')).resolves.toEqual([batch]);
	await expect(zuora.fetchFile(batch, '2026-11-04')).resolves.toEqual({
		batchName: 'subscriptions',
		fileName: 'subscriptions_2026-11-04_file-id.csv',
		data: Buffer.from('subscription-number\nA-S000001'),
	});

	expect(fetchMock).toHaveBeenCalledTimes(3);
	expect(fetchMock).toHaveBeenNthCalledWith(
		2,
		'https://apisandbox.zuora.com/apps/api/batch-query/jobs/job-id',
		expect.objectContaining({
			headers: expect.objectContaining({
				Authorization: 'Bearer token',
			}),
		}),
	);
	expect(fetchMock).toHaveBeenNthCalledWith(
		3,
		'https://apisandbox.zuora.com/apps/api/batch-query/file/file-id',
		expect.objectContaining({
			headers: expect.objectContaining({
				Authorization: 'Bearer token',
			}),
		}),
	);
});
