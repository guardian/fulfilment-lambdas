/* eslint-env jest */
import { handler } from '../../src/weekly/salesforce_uploader';

var MockDate = require('mockdate');
// mock current date
MockDate.set('11/07/2017 02:31');

jest.mock('../../src/lib/salesforceAuthenticator', () => ({
	authenticate: jest.fn(),
}));

jest.mock('../../src/lib/S3ToSalesforceUploader');

const mockedUpload = require('../../src/lib/S3ToSalesforceUploader');

jest.mock('../../src/lib/config', () => ({
	getStage: () => 'CODE',
	fetchConfig: async () => ({
		fulfilments: {
			homedelivery: {
				uploadFolder: {
					folderId: 'homeDelivery_pipeline',
					name: 'Home_Delivery_Pipeline_Fulfilment',
					bucket: 'fulfilment-bucket-name',
					prefix: 'TEST/fulfilment_output/',
				},
				downloadFolder: {
					folderId: 'home_delivery_sf_folder',
					name: 'HOME_DELIVERY_FULFILMENT',
					bucket: 'fulfilment-bucket-name',
					prefix: 'TEST/salesforce_output/HOME_DELIVERY_FULFILMENT/',
				},
			},
			weekly: {
				VU: {
					uploadFolder: {
						folderId: 'folderId_VU_RELEASE',
						name: 'Weekly_Pipeline_VU',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_VU/',
					},
					downloadFolder: {
						folderId: 'folderId_VU_SF',
						name: 'Guardian Weekly (Vanuatu)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/vu/',
					},
				},
				HK: {
					uploadFolder: {
						folderId: 'folderId_HK_RELEASE',
						name: 'Weekly_Pipeline_HK',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_HK/',
					},
					downloadFolder: {
						folderId: 'folderId_HK_SF',
						name: 'Guardian Weekly (Hong Kong)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/hk/',
					},
				},
				ROW: {
					uploadFolder: {
						folderId: 'folderId_ROW_RELEASE',
						name: 'Weekly_Pipeline_ROW',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_ROW/',
					},
					downloadFolder: {
						folderId: 'folderId_ROW_SF',
						name: 'Guardian Weekly (Rest of tge World)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/row/',
					},
				},
				AU: {
					uploadFolder: {
						folderId: 'folderId_AU_RELEASE',
						name: 'Weekly_Pipeline_AU',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_AU/',
					},
					downloadFolder: {
						folderId: 'folderId_AU_RELEASE',
						name: 'Guardian Weekly (Australia)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/au/',
					},
				},
				US: {
					uploadFolder: {
						folderId: 'folderId_US_RELEASE',
						name: 'Weekly_Pipeline_US',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_US/',
					},
					downloadFolder: {
						folderId: 'folderId_US_SF',
						name: 'Guardian Weekly (USA)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/usa/',
					},
				},
				EU: {
					uploadFolder: {
						folderId: 'folderId_EU_RELEASE',
						name: 'Weekly_Pipeline_EU',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_EU/',
					},
					downloadFolder: {
						folderId: 'folderId_EU_SF',
						name: 'Guardian Weekly (EU)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/eu/',
					},
				},
				NZ: {
					uploadFolder: {
						folderId: 'folderId_NZ_RELEASE',
						name: 'Weekly_Pipeline_NZ',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_NZ/',
					},
					downloadFolder: {
						folderId: 'folderId_NZ_SF',
						name: 'Guardian Weekly (New Zealand)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/nz/',
					},
				},
				UK: {
					uploadFolder: {
						folderId: 'folderId_UK_RELEASE',
						name: 'Weekly_Pipeline_UK',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_UK/',
					},
					downloadFolder: {
						folderId: 'folderId_UK_SF',
						name: 'Guardian Weekly (UK)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/uk/',
					},
				},
				CAHAND: {
					uploadFolder: {
						folderId: 'folderId_CA_HAND_RELEASE',
						name: 'Weekly_Pipeline_CA_HAND',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_CA_HAND/',
					},
					downloadFolder: {
						folderId: 'folderId_CA_HAND_SF',
						name: 'Guardian Weekly (canada hand delivery)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/ca_hand/',
					},
				},
				CA: {
					uploadFolder: {
						folderId: 'folderId_CA_RELEASE',
						name: 'Weekly_Pipeline_CA',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/fulfilments/Weekly_CA/',
					},
					downloadFolder: {
						folderId: 'folderId_CA_SF',
						name: 'Guardian Weekly (Canada)',
						bucket: 'fulfilment-bucket-name',
						prefix: 'TEST/salesforce_output/weekly/ca/',
					},
				},
			},
		},
	}),
}));

beforeEach(() => {
	process.env.Stage = 'CODE';
	mockedUpload.uploadFiles.mock.calls = [];
});

it('should construct correct source and destination file paths for upload', async () => {
	const mockUploadFilesFunction = mockedUpload.uploadFiles.mockResolvedValue(
		{},
	);
	await handler({ deliveryDate: '2017-07-06' });
	expect(mockUploadFilesFunction).toBeCalled();
	const argumentsPassedinToUploadFiles =
		mockUploadFilesFunction.mock.calls[0][0];
	const expectedArgument = {
		destination: {
			fileName: 'GWNZ_06_07_2017_07112017_02.csv',
			sfDescription: 'Weekly fulfilment file GWNZ_06_07_2017_07112017_02.csv',
			sfFolder: { folderId: 'folderId_NZ_RELEASE', name: 'Weekly_Pipeline_NZ' },
		},
		source: {
			bucket: 'fulfilment-bucket-name',
			prefix: 'TEST/fulfilments/Weekly_NZ/2017-07-06_WEEKLY.csv',
		},
	};
	expect(argumentsPassedinToUploadFiles).toContainEqual(expectedArgument);
});
