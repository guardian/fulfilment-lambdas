/* eslint-env jest */
import * as sfUpload from '../../src/lib/salesforceUpload'

import moment from 'moment'

var MockDate = require('mockdate')

let config = {
  fulfilments: {
    homedelivery: {
      uploadFolder: {
        folderId: 'homeDelivery_pipeline',
        name: 'Home_Delivery_Pipeline_Fulfilment',
        bucket: 'fulfilment-bucket-name',
        prefix: 'TEST/fulfilment_output/'
      },
      downloadFolder: {
        folderId: 'home_delivery_sf_folder',
        name: 'HOME_DELIVERY_FULFILMENT',
        bucket: 'fulfilment-bucket-name',
        prefix: 'TEST/salesforce_output/HOME_DELIVERY_FULFILMENT/'
      }
    },
    weekly: {
      VU: {
        uploadFolder: {
          folderId: 'folderId_VU_RELEASE',
          name: 'Weekly_Pipeline_VU',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_VU/'
        },
        downloadFolder: {
          folderId: 'folderId_VU_SF',
          name: 'Guardian Weekly (Vanuatu)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/vu/'
        }
      },
      HK: {
        uploadFolder: {
          folderId: 'folderId_HK_RELEASE',
          name: 'Weekly_Pipeline_HK',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_HK/'
        },
        downloadFolder: {
          folderId: 'folderId_HK_SF',
          name: 'Guardian Weekly (Hong Kong)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/hk/'
        }
      },
      ROW: {
        uploadFolder: {
          folderId: 'folderId_ROW_RELEASE',
          name: 'Weekly_Pipeline_ROW',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_ROW/'
        },
        downloadFolder: {
          folderId: 'folderId_ROW_SF',
          name: 'Guardian Weekly (Rest of tge World)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/row/'
        }
      },
      AU: {
        uploadFolder: {
          folderId: 'folderId_AU_RELEASE',
          name: 'Weekly_Pipeline_AU',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_AU/'
        },
        downloadFolder: {
          folderId: 'folderId_AU_RELEASE',
          name: 'Guardian Weekly (Australia)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/au/'
        }
      },
      US: {
        uploadFolder: {
          folderId: 'folderId_US_RELEASE',
          name: 'Weekly_Pipeline_US',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_US/'
        },
        downloadFolder: {
          folderId: 'folderId_US_SF',
          name: 'Guardian Weekly (USA)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/usa/'
        }
      },
      FR: {
        uploadFolder: {
          folderId: 'folderId_FR_RELEASE',
          name: 'Weekly_Pipeline_FR',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_FR/'
        },
        downloadFolder: {
          folderId: 'folderId_FR_SF',
          name: 'Guardian Weekly (France)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/fr/'
        }
      },
      NZ: {
        uploadFolder: {
          folderId: 'folderId_NZ_RELEASE',
          name: 'Weekly_Pipeline_NZ',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_NZ/'
        },
        downloadFolder: {
          folderId: 'folderId_NZ_SF',
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
          folderId: 'folderId_CA_HAND_RELEASE',
          name: 'Weekly_Pipeline_CA_HAND',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_CA_HAND/'
        },
        downloadFolder: {
          folderId: 'folderId_CA_HAND_SF',
          name: 'Guardian Weekly (canada hand delivery)',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/salesforce_output/weekly/ca_hand/'
        }
      },
      CA: {
        uploadFolder: {
          folderId: 'folderId_CA_RELEASE',
          name: 'Weekly_Pipeline_CA',
          bucket: 'fulfilment-bucket-name',
          prefix: 'TEST/fulfilments/Weekly_CA/'
        },
        downloadFolder: {
          folderId: 'folderId_CA_SF',
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
jest.mock('../../src/lib/storage')
let mockedStorage = require('../../src/lib/storage')

function expectedUploadFolder(weeklyRegion: string) {
  let uploadFolder = config.fulfilments.weekly[weeklyRegion].uploadFolder
  return {
    folderId: uploadFolder.folderId,
    name: uploadFolder.name,
  }
}

beforeEach(() => {
  mockedStorage.getObject.mock.calls = []
  mockSalesForce.uploadDocument.mock.calls = []
})

test('should upload weekly files', done => {
  mockedStorage.getObject = jest.fn().mockImplementation(path => {
    return Promise.resolve({
      file: {
        Body: 'something'
      }
    })
  })

// mock current date..
  MockDate.set('11/07/2017 02:31')

  let deliveryDate = moment('2017-11-17')

  sfUpload.uploadFiles(config, 'weekly', deliveryDate).then(res => {
    try {
      //downloads from s3
      expect(mockedStorage.getObject.mock.calls.length).toBe(10)
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
      
      //uploads to sf
      expect(mockSalesForce.uploadDocument.mock.calls.length).toBe(10)

      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWNZ_17_11_2017_07112017_02.csv',expectedUploadFolder('NZ'), "Weekly fulfilment file  GWNZ_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWVA_17_11_2017_07112017_02.csv',expectedUploadFolder('VU'), "Weekly fulfilment file  GWVA_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWHK_17_11_2017_07112017_02.csv',expectedUploadFolder('HK'), "Weekly fulfilment file  GWHK_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWUS_17_11_2017_07112017_02.csv',expectedUploadFolder('US'), "Weekly fulfilment file  GWUS_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWCA_17_11_2017_07112017_02.csv',expectedUploadFolder('CA'), "Weekly fulfilment file  GWCA_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWAU_17_11_2017_07112017_02.csv',expectedUploadFolder('AU'), "Weekly fulfilment file  GWAU_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWUK_17_11_2017_07112017_02.csv',expectedUploadFolder('UK'), "Weekly fulfilment file  GWUK_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWRW_17_11_2017_07112017_02.csv',expectedUploadFolder('ROW'), "Weekly fulfilment file  GWRW_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWFR_17_11_2017_07112017_02.csv',expectedUploadFolder('FR'), "Weekly fulfilment file  GWFR_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWCA_HAND_17_11_2017_07112017_02.csv',expectedUploadFolder('CAHAND'), "Weekly fulfilment file  GWCA_HAND_17_11_2017_07112017_02.csv",undefined)

      let expectedResponse = [
        { id: 'documentId', name: 'GWNZ_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWFR_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWAU_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWCA_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWCA_HAND_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWHK_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWRW_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWUK_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWUS_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWVA_17_11_2017_07112017_02.csv' }
      ]
      expect(res).toEqual(expectedResponse)
      done()
    } catch (e) {
      done.fail(e)
    }
  })
})

test('should ignore missing weekly files', done => {
// mock current date..
  MockDate.set('11/07/2017 02:31')

  mockedStorage.getObject = jest.fn().mockImplementation(path => {
    if (path === 'TEST/fulfilments/Weekly_NZ/2017-11-17_WEEKLY.csv' || path === 'TEST/fulfilments/Weekly_VU/2017-11-17_WEEKLY.csv') {
      return Promise.resolve({
        file: {
          Body: 'something'
        }
      })
    }
    return Promise.reject(new Error('file not found'))
  })

  let deliveryDate = moment('2017-11-17')

  sfUpload.uploadFiles(config, 'weekly', deliveryDate).then(res => {
    try {
      expect(mockedStorage.getObject.mock.calls.length).toBe(10)
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

      //uploads to sf
      expect(mockSalesForce.uploadDocument.mock.calls.length).toBe(2)

      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWNZ_17_11_2017_07112017_02.csv',expectedUploadFolder('NZ'), "Weekly fulfilment file  GWNZ_17_11_2017_07112017_02.csv",undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('GWVA_17_11_2017_07112017_02.csv',expectedUploadFolder('VU'), "Weekly fulfilment file  GWVA_17_11_2017_07112017_02.csv",undefined)


      let expectedResponse = [
        { id: 'documentId', name: 'GWNZ_17_11_2017_07112017_02.csv' },
        { id: 'documentId', name: 'GWVA_17_11_2017_07112017_02.csv' }
      ]
      expect(res).toEqual(expectedResponse)
      done()
    } catch (e) {
      done.fail(e)
    }
  })
})

test('should upload home delivery file', done => {
  mockedStorage.getObject = jest.fn().mockImplementation(path => {
    return Promise.resolve({
      file: {
        Body: 'something'
      }
    })
  })

// mock current date..
  MockDate.set('11/07/2017 02:31')

  let deliveryDate = moment('2017-11-17')

  sfUpload.uploadFiles(config, 'homedelivery', deliveryDate).then(res => {
    try {
      expect(mockedStorage.getObject.mock.calls.length).toBe(1)
      expect(mockedStorage.getObject).toHaveBeenCalledWith('TEST/fulfilment_output/2017-11-17_HOME_DELIVERY.csv')

      let expectedResponse = [ { id: 'documentId', name: 'HOME_DELIVERY_Friday_17_11_2017.csv' } ]
      expect(res).toEqual(expectedResponse)
      done()
    } catch (e) {
      done.fail(e)
    }
  })
})
