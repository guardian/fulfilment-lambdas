/* eslint-env jest */
import { handler } from '../../src/exporter'
import { readFile } from 'fs'
var MockDate = require('mockdate')

let mockOutput = {}
// mock current date
MockDate.set('7/5/2017')

function getTestFile (fileName, callback) {
  let filePath = `./__tests__/resources/expected/${fileName}`
  readFile(filePath, 'utf8', function (err, data) {
    if (err) {
      callback(err)
      return
    }
    callback(null, data)
  })
}

jest.mock('../../src/lib/storage', () => {
  let fs = require('fs')
  const streamToString = require('stream-to-string')

  return {
    upload: async (stream, outputLocation, folder) => {
      let outputPath = folder.prefix + outputLocation.filename
      mockOutput[outputPath] = await streamToString(stream)
      return outputLocation
    },
    createReadStream: (filePath) => {
      let testFilePath = `./__tests__/resources/${filePath}`
      console.log(`loading test file ${testFilePath} ...`)
      return fs.createReadStream(testFilePath)
    }
  }
})

jest.mock('../../src/lib/config', () => ({
  getStage: () => 'CODE',
  fetchConfig: async () => (
    {
      fulfilments: {
        weekly: {
          VU: {
            uploadFolder: {
              folderId: null,
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
    })
}))

function verify (done, expectedError, expectedResponse, expectedFileNames) {
  return function (err, res) {
    try {
      expect(err).toEqual(expectedError)
      if (err) {
        done()
        return
      }

      if (expectedResponse) {
        let responseAsJson = JSON.parse(JSON.stringify(res))
        expect(responseAsJson).toEqual(expectedResponse)
      }
      if (expectedFileNames) {
        expectedFileNames.map((expectedFileName) => {
          getTestFile(expectedFileName, function (err, expectedContents) {
            if (err) {
              done.fail(err)
              return
            }
            expect(mockOutput[expectedFileName]).toEqual(expectedContents)
          })
          done()
        })
      }
      done()
    } catch (error) {
      done.fail(error)
    }
  }
}

beforeEach(() => {
  process.env.Stage = 'CODE'
  mockOutput = {}
})

test('should return error on missing query subscriptions query result for weekly', done => {
  let input = {
    type: 'weekly',
    deliveryDate: '2017-07-06',
    results: [
      {
        queryName: 'WeeklyHolidaySuspensions',
        fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv'
      },
      {
        queryName: 'WeeklyIntroductoryPeriods',
        fileName: 'weeklyIntroductoryPeriods_2017-07-06.csv'
      }
    ]
  }
  let expectedError = new Error('Invalid input cannot find unique query called WeeklySubscriptions')
  handler(input, {}, verify(done, expectedError, null, null))
})

test('should return error on invalid deliveryDate for weekly', done => {
  let input = {
    type: 'weekly',
    deliveryDate: '2017-14-06',
    results: [{
      queryName: 'WeeklySubscriptions',
      fileName: 'WeeklySubscriptions_2017-07-06.csv'
    },
    {
      queryName: 'WeeklyHolidaySuspensions',
      fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv'
    },
    {
      queryName: 'WeeklyIntroductoryPeriods',
      fileName: 'WeeklyIntroductoryPeriods_2017-07-06.csv'
    }
    ]
  }
  let expectedError = new Error('invalid deliverydate expected format YYYY-MM-DD')
  handler(input, {}, verify(done, expectedError, null, null))
})

test('should generate correct fulfilment file for weekly', done => {
  let input = {
    type: 'weekly',
    deliveryDate: '2017-07-06',
    results: [
      {
        queryName: 'WeeklySubscriptions',
        fileName: 'WeeklySubscriptions_2017-07-06.csv'
      },
      {
        queryName: 'WeeklyHolidaySuspensions',
        fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv'
      },
      {
        queryName: 'WeeklyIntroductoryPeriods',
        fileName: 'WeeklyIntroductoryPeriods_2017-07-06.csv'
      }
    ]
  }

  let expectedResponse = {...input, 'fulfilmentFile': '2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv,2017-07-06_WEEKLY.csv'}
  let expectedFileNames = [
    'TEST/fulfilments/Weekly_UK/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_CA/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_CA_HAND/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_US/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_AU/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_FR/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_ROW/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_HK/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_VU/2017-07-06_WEEKLY.csv',
    'TEST/fulfilments/Weekly_NZ/2017-07-06_WEEKLY.csv']
  handler(input, {}, verify(done, null, expectedResponse, expectedFileNames))
})
