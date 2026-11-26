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
	afterEach(() => jest.restoreAllMocks());

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

	it('skips weekly download folders that are not configured', async () => {
		const consoleWarn = jest
			.spyOn(console, 'warn')
			.mockImplementation(() => undefined);
		const activeFolder = {
			folderId: 'active-folder-id',
			name: 'ACTIVE_WEEKLY_FOLDER',
			bucket: 'fulfilment-export-code',
			prefix: 'salesforce_output/weekly/active/',
		};
		mockedConfig.fetchConfig.mockResolvedValue({
			...config,
			fulfilments: {
				...config.fulfilments,
				weekly: {
					ACTIVE: { downloadFolder: activeFolder },
					MISSING: {},
					PLACEHOLDER: {
						downloadFolder: {
							...activeFolder,
							folderId: 'TODO',
							name: 'PLACEHOLDER_WEEKLY_FOLDER',
						},
					},
				},
			},
		});
		const getDocuments = jest.fn().mockResolvedValue([]);
		mockedSalesforce.authenticate.mockResolvedValue({ getDocuments });

		const result = await (handler as any)({}, {}, jest.fn());

		expect(result).toEqual({
			HOME_DELIVERY_FULFILMENT: [],
			ACTIVE_WEEKLY_FOLDER: [],
		});
		expect(getDocuments).toHaveBeenCalledTimes(2);
		expect(getDocuments).toHaveBeenCalledWith(activeFolder);
		expect(consoleWarn).toHaveBeenCalledWith(
			'Skipping unconfigured weekly download folder: MISSING',
		);
		expect(consoleWarn).toHaveBeenCalledWith(
			'Skipping unconfigured weekly download folder: PLACEHOLDER',
		);
	});
});
