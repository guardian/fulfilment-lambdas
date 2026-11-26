/* eslint-env jest */

import { handler } from '../src/salesforce_downloader';

jest.mock('../src/lib/config', () => ({
	fetchConfig: jest.fn(),
}));

jest.mock('../src/lib/salesforceAuthenticator', () => ({
	authenticate: jest.fn(),
}));

jest.mock('../src/lib/storage', () => ({
	ls: jest.fn(),
	upload: jest.fn(),
}));

const mockedConfig = require('../src/lib/config');
const mockedSalesforce = require('../src/lib/salesforceAuthenticator');
const mockedStorage = require('../src/lib/storage');

const config = {
	stage: 'CODE',
	fulfilments: {
		homedelivery: {
			downloadFolder: {
				folderId: 'home-delivery-folder-id',
				name: 'HOME_DELIVERY_FULFILMENT',
				bucket: 'fulfilment-export-code',
				prefix: 'salesforce_output/home-delivery/',
			},
		},
		weekly: {},
	},
};

describe('salesforce downloader handler', () => {
	beforeEach(() => {
		jest.resetAllMocks();
		mockedConfig.fetchConfig.mockResolvedValue(config);
		mockedStorage.ls.mockResolvedValue([]);
	});

	it('waits for the download to complete before returning', async () => {
		const getDocuments = jest.fn().mockResolvedValue([]);
		mockedSalesforce.authenticate.mockResolvedValue({ getDocuments });

		const result = await (handler as any)({ source: 'test' }, {}, jest.fn());

		expect(result).toEqual({
			source: 'test',
			HOME_DELIVERY_FULFILMENT: [],
		});
		expect(getDocuments).toHaveBeenCalledWith(
			config.fulfilments.homedelivery.downloadFolder,
		);
	});

	it('rejects when the download fails', async () => {
		mockedSalesforce.authenticate.mockRejectedValue(
			new Error('authentication failed'),
		);

		await expect(
			(handler as any)({ source: 'test' }, {}, jest.fn()),
		).rejects.toThrow('authentication failed');
	});
});
