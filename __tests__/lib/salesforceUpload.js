/* eslint-env jest */
import * as sfUpload from '../../src/lib/salesforceUpload'

import moment from 'moment'

var MockDate = require('mockdate')

let config = {
  fulfilments: {
    weekly: {
      VU: {
        uploadFolder: {
          folderId: 'folderIdVU',
          name: 'Weekly_Pipeline_VU',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_VU/'
        },
        downloadFolder: {
          folderId: 'folderId1',
          name: 'Guardian Weekly (Vanuatu)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/vu/'
        }
      },
      HK: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_HK',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_HK/'
        },
        downloadFolder: {
          folderId: 'folderId2',
          name: 'Guardian Weekly (Hong Kong)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/hk/'
        }
      },
      ROW: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_ROW',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_ROW/'
        },
        downloadFolder: {
          folderId: 'folderId3',
          name: 'Guardian Weekly (Rest of tge World)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/row/'
        }
      },
      AU: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_AU',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_AU/'
        },
        downloadFolder: {
          folderId: 'folderId4',
          name: 'Guardian Weekly (Australia)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/au/'
        }
      },
      US: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_US',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_US/'
        },
        downloadFolder: {
          folderId: '00l0J000002OrHhQAK',
          name: 'Guardian Weekly (USA)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/usa/'
        }
      },
      FR: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_FR',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_FR/'
        },
        downloadFolder: {
          folderId: 'folderId5',
          name: 'Guardian Weekly (France)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/fr/'
        }
      },
      NZ: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_NZ',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_NZ/'
        },
        downloadFolder: {
          folderId: 'folderId6',
          name: 'Guardian Weekly (New Zealand)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/nz/'
        }
      },
      UK: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_UK',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_UK/'
        },
        downloadFolder: {
          folderId: 'folderId7',
          name: 'Guardian Weekly (UK)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/uk/'
        }
      },
      CAHAND: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_CA_HAND',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_CA_HAND/'
        },
        downloadFolder: {
          folderId: 'folderId8',
          name: 'Guardian Weekly (canada hand delivery)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/ca_hand/'
        }
      },
      CA: {
        uploadFolder: {
          folderId: null,
          name: 'Weekly_Pipeline_CA',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_CA/'
        },
        downloadFolder: {
          folderId: 'folderId19',
          name: 'Guardian Weekly (Canada)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/ca/'
        }
      }
    }
  }
}

let mockSalesForce = {
  uploadDocument: jest.fn(() => Promise.resolve({id: 'documentId'}))
}

jest.mock('../../src/lib/salesforceAuthenticator', () => {
  return {
    authenticate: (config) => { return Promise.resolve(mockSalesForce) }
  }
})

jest.mock('../../src/lib/config')
jest.mock('../../src/lib/storage');
let mockedStorage = require('../../src/lib/storage')
mockedStorage.getObject = jest.fn().mockImplementation( path => {
  return Promise.resolve({
    file: {
      Body: 'something'
    }
  })
})

    // createReadStream: async (filePath) => {
    //   let testFilePath = `./__tests__/resources/${filePath}`
    //   console.log(`loading test file ${testFilePath} ...`)
    //   return fs.createReadStream(testFilePath)
    // }
//  }
//})

test('uploadFiles', done => {
// mock current date..
  MockDate.set('11/07/2017 02:31')

  let deliveryDate = moment('2017-11-17')

 sfUpload.uploadFiles(config, deliveryDate).then(res => {
   try {
     expect(mockedStorage.getObject.mock.calls.length).toBe(10)
     let getObjectCalls = mockedStorage.getObject.mock.calls
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_NZ/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_VU/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_UK/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_US/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_HK/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_ROW/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_AU/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_FR/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_CA_HAND/2017-11-17_WEEKLY.csv')
     expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilments/Weekly_CA/2017-11-17_WEEKLY.csv')
     let expectedResponse =  [{"id": "documentId", "name": "GWNZ_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWFR_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWAU_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWCA_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWCA_HAND_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWHK_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWRW_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWUK_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWUS_17_11_2017_07112017_02.csv"}, {"id": "documentId", "name": "GWVA_17_11_2017_07112017_02.csv"}]

     expect(res).toEqual(expectedResponse)
    done()
   }
   catch(e) {
     console.log("DONE FAIL")
     done.fail(e)
   }
 })
})
