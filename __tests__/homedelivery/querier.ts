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
				username: 'fakeUser',
				password: 'fakePass',
			},
		},
		stage: 'CODE',
	};
	return {
		fetchConfig: jest.fn(() => Promise.resolve(fakeResponse)),
	};
});

jest.mock('request', () => {
	return function (
		options: unknown,
		callback: (arg1: unknown, res: unknown, body: unknown) => void,
	) {
		const response = {
			statusCode: 200,
		};
		const body = {
			id: 'someId',
		};
		// TODO SEE IF WE CAN VERIFY SOMETHING ABOUT THE QUERIES HERE!
		callback(null, response, body);
	};
});

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
