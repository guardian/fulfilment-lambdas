/* eslint-env jest */
import { handler } from '../../src/exporter'
import { readFile } from 'fs'
var MockDate = require('mockdate')

let mockOutput = null
// mock current date
MockDate.set('7/5/2017')

function getTestFile (fileName, callback) {
  const filePath = `./__tests__/resources/expected/${fileName}`
  readFile(filePath, 'utf8', function (err, data) {
    if (err) {
      callback(err)
      return
    }
    callback(null, data)
  })
}

jest.mock('../../src/lib/storage', () => {
  const fs = require('fs')
  const streamToString = require('stream-to-string')

  return {
    upload: async (stream, outputLocation) => {
      mockOutput = await streamToString(stream)
      return outputLocation
    },
    createReadStream: async (filePath) => {
      const testFilePath = `./__tests__/resources/${filePath}`
      console.log(`loading test file ${testFilePath} ...`)
      return fs.createReadStream(testFilePath)
    }
  }
})

jest.mock('../../src/lib/config', () => ({
  getStage: () => 'CODE',
  fetchConfig: async () => ({ fulfilments: { homedelivery: { uploadFolder: '' } } })
}))

function verify (done, expectedError, expectedResponse, expectedFileName) {
  return function (err, res) {
    try {
      expect(err).toEqual(expectedError)
      if (err) {
        done()
        return
      }

      if (expectedResponse) {
        const responseAsJson = JSON.parse(JSON.stringify(res))
        expect(responseAsJson).toEqual(expectedResponse)
      }
      if (expectedFileName) {
        getTestFile(expectedFileName, function (err, expectedContents) {
          if (err) {
            done.fail(err)
            return
          }
          expect(mockOutput).toEqual(expectedContents)
          done()
        })
      }
    } catch (error) {
      done.fail(error)
    }
  }
}

beforeEach(() => {
  process.env.Stage = 'CODE'
  mockOutput = null
})

test('should return error on missing query subscriptions query result', done => {
  const input = {
    type: 'homedelivery',
    deliveryDate: '2017-07-06',
    results: [
      {
        queryName: 'HolidaySuspensions',
        fileName: 'HolidaySuspensions_2017-07-06.csv'
      }
    ]
  }
  const expectedError = new Error('Invalid input cannot find unique query called Subscriptions')
  handler(input, {}, verify(done, expectedError, null, null))
})

test('should return error on invalid deliveryDate', done => {
  const input = {
    type: 'homedelivery',
    deliveryDate: '2017-14-06',
    results: [
      {
        queryName: 'HolidaySuspensions',
        fileName: 'HolidaySuspensions_2017-07-06.csv'
      }
    ]
  }
  const expectedError = new Error('invalid deliverydate expected format YYYY-MM-DD')
  handler(input, {}, verify(done, expectedError, null, null))
})

test('should generate correct fulfilment file', done => {
  const input = {
    type: 'homedelivery',
    deliveryDate: '2017-07-06',
    results: [
      {
        queryName: 'Subscriptions',
        fileName: 'Subscriptions_2017-07-06.csv'
      },
      {
        queryName: 'HolidaySuspensions',
        fileName: 'HolidaySuspensions_2017-07-06.csv'
      }
    ]
  }
  const expectedFileName = '2017-07-06_HOME_DELIVERY.csv'
  const expectedResponse = { ...input, fulfilmentFile: expectedFileName }
  handler(input, {}, verify(done, null, expectedResponse, expectedFileName))
})
