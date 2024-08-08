/* eslint-env jest */

import { handler } from '../src/salesforceUploader';
import moment from 'moment';

const mockSalesForce = {
	uploadDocument: jest.fn(() => Promise.resolve({ id: 'documentId' })),
};

jest.mock('../src/lib/storage', () => {
	const validPaths = [
		'fulfilment_output/2017-06-12_HOME_DELIVERY.csv',
		'fulfilment_output/2017-06-13_HOME_DELIVERY.csv',
		'fulfilment_output/2017-06-14_HOME_DELIVERY.csv',
	];
	return {
		copyObject: jest.fn(() => Promise.resolve('ok')),
		getObject: (path: string) => {
			if (validPaths.includes(path)) {
				return Promise.resolve({
					Body: 'csv would be here',
					LastModified: new Date('12/30/2016'),
				});
			} else {
				return Promise.reject(new Error('NoSuchKey'));
			}
		},
	};
});

const mockStorage = require('../src/lib/storage');
jest.mock('../src/lib/salesforceAuthenticator', () => {
	return {
		authenticate: () => {
			return Promise.resolve(mockSalesForce);
		},
	};
});
jest.mock('../src/lib/config', () => ({
	getStage: () => 'CODE',
	fetchConfig: async () => ({
		api: {
			expectedToken: 'testToken',
		},
		stage: 'CODE',
		fulfilments: {
			homedelivery: {
				uploadFolder: { folderId: 'someFolderId', name: 'someFolderName' },
			},
		},
	}),
}));

function getFakeInput(token: string, date: string, amount: number) {
	return {
		headers: { apiToken: token },
		body: JSON.stringify({ date, amount }),
	};
}

function errorResponse(status: number, message: string) {
	return {
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message }),
		statusCode: status,
	};
}

type DoneFunction = {
	(error?: string): void;
	fail(str: string): void;
};

function verify(
	done: DoneFunction,
	expectedResponse: unknown,
	expectedFulfilmentDays: string[],
) {
	return function (err: unknown, res: unknown) {
		if (err) {
			const errDesc = JSON.stringify(err);
			done.fail(`Unexpected error Response ${errDesc}`);
			return;
		}
		const responseAsJson = JSON.parse(JSON.stringify(res));
		const expectedResponseAsJson = JSON.parse(JSON.stringify(expectedResponse));
		try {
			expect(responseAsJson).toEqual(expectedResponseAsJson);
			expect(mockSalesForce.uploadDocument.mock.calls.length).toBe(
				expectedFulfilmentDays.length,
			);
			expect(mockStorage.copyObject.mock.calls.length).toBe(
				expectedFulfilmentDays.length,
			);
			const expectedFolder = {
				folderId: 'someFolderId',
				name: 'someFolderName',
			};
			expectedFulfilmentDays.forEach(function (date: string) {
				const parsedDate = moment(date, 'YYYY-MM-DD');
				const dayOfTheWeek = parsedDate.format('dddd');
				const formattedDate = parsedDate.format('DD_MM_YYYY');
				const expectedSalesForceFileName = `HOME_DELIVERY_${dayOfTheWeek}_${formattedDate}.csv`;
				const expectedDescription = `Home Delivery fulfilment file ${expectedSalesForceFileName}`;
				expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith(
					expectedSalesForceFileName,
					expectedFolder,
					expectedDescription,
					'csv would be here',
				);
				expect(mockStorage.copyObject).toHaveBeenCalledWith(
					`fulfilment_output/${date}_HOME_DELIVERY.csv`,
					`uploaded/${expectedSalesForceFileName}`,
				);
			});
			done();
		} catch (error) {
			done.fail(JSON.stringify(error));
		}
	};
}

beforeEach(() => {
	mockSalesForce.uploadDocument.mock.calls = [];
	mockStorage.copyObject.mock.calls = [];
});

test('should return error if api token is wrong', (done) => {
	const wrongTokenInput = getFakeInput('wrongToken', '2017-06-12', 1);
	const expectedResponse = errorResponse(401, 'Unauthorized');
	const expectedFulfilmentDates: string[] = [];
	handler(
		wrongTokenInput,
		{},
		verify(done, expectedResponse, expectedFulfilmentDates),
	);
});

test('should return 400 error required parameters are missing', (done) => {
	const emptyRequest = { body: '{}', headers: {} };
	const expectedResponse = errorResponse(400, 'missing amount or date');
	const expectedFulfilments: string[] = [];
	handler(
		emptyRequest,
		{},
		verify(done, expectedResponse, expectedFulfilments),
	);
});
test('should return 400 error no api token is provided', (done) => {
	const noApiToken = { headers: {}, body: '{"date":"2017-01-02", "amount":1}' };
	const expectedFulfilments: string[] = [];
	const expectedResponse = errorResponse(400, 'ApiToken header missing');
	handler(noApiToken, {}, verify(done, expectedResponse, expectedFulfilments));
});
test('should return 400 error if too many days in request', (done) => {
	const tooManyDaysInput = getFakeInput('testToken', '2017-06-12', 21);
	const expectedResponse = errorResponse(
		400,
		'amount should be a number between 1 and 5',
	);
	const expectedFulfilments: string[] = [];
	handler(
		tooManyDaysInput,
		{},
		verify(done, expectedResponse, expectedFulfilments),
	);
});
test('should return error if files not found in bucket', (done) => {
	const input = getFakeInput('testToken', '2017-06-14', 4);
	const expectedFulfilments: string[] = [];
	const expectedResponse = errorResponse(500, 'Unexpected server error');
	handler(input, {}, verify(done, expectedResponse, expectedFulfilments));
});

test('should upload to sf and return file data', (done) => {
	const input = getFakeInput('testToken', '2017-06-12', 2);
	const successResponse = {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
		},
		body: '{"message":"ok","files":[{"name":"HOME_DELIVERY_Monday_12_06_2017.csv","id":"documentId","lastModified":"2016-12-30"},{"name":"HOME_DELIVERY_Tuesday_13_06_2017.csv","id":"documentId","lastModified":"2016-12-30"}]}',
	};
	const expectedFulfilments = ['2017-06-12', '2017-06-13'];
	handler(input, {}, verify(done, successResponse, expectedFulfilments));
});

test('should return error if api token is wrong', (done) => {
	const wrongTokenInput = getFakeInput('wrongToken', '2017-06-12', 1);
	const expectedResponse = errorResponse(401, 'Unauthorized');
	const expectedFulfilmentDates: string[] = [];
	handler(
		wrongTokenInput,
		{},
		verify(done, expectedResponse, expectedFulfilmentDates),
	);
});
