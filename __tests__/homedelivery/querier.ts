/* eslint-env jest */

import { handler, Input } from '../../src/querier';

var MockDate = require('mockdate');

// mock current date
MockDate.set('7/5/2017');
jest.mock('../../src/lib/config', () => {
	const fakeResponse = {
		zuora: {
			api: {
				url: 'http://fake-zuora-utl.com',
				oauthUrl: 'http://fake-zuora-oauth-url.com',
				clientId: 'fakeClientId',
				clientSecret: 'fakeClientSecret',
			},
		},
		stage: 'CODE',
	};
	return {
		fetchConfig: jest.fn(() => Promise.resolve(fakeResponse)),
	};
});

// Mock fetch
global.fetch = jest.fn((input) => {
	const url = input.toString();
	const json =
		url === 'http://fake-zuora-oauth-url.com/oauth/token'
			? { access_token: 'token', expires_in: 3600 }
			: { id: 'someId' };
	return Promise.resolve({
		ok: true,
		status: 200,
		json: () => Promise.resolve(json),
	});
}) as jest.Mock;

test('should return error if missing delivery date and deliveryDateDaysFromNow ', async () => {
	await expect(handler({ type: 'homedelivery' })).rejects.toThrow();
});

test('should return error if delivery date is in the wrong format', async () => {
	const input: Input = {
		deliveryDate: 'wrong format',
		type: 'homedelivery',
	};

	await expect(handler(input)).rejects.toThrow();
});

it('should query zuora for specific date', async () => {
	const input: Input = {
		deliveryDate: '2017-07-06',
		type: 'homedelivery',
	};

	const expectedResponse = { ...input, jobId: 'someId' };
	await expect(handler(input)).resolves.toEqual(expectedResponse);
});

it('should query zuora for daysFromNow', async () => {
	const input: Input = {
		deliveryDateDaysFromNow: 5,
		type: 'homedelivery',
	};
	const expectedResponse = {
		...input,
		deliveryDate: '2017-07-10',
		jobId: 'someId',
	};
	await expect(handler(input)).resolves.toEqual(expectedResponse);
});
