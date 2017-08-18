/* eslint-env jest */
import { handler } from '../../src/exporter'
import { readFile } from 'fs'
var MockDate = require('mockdate')

let mockOutput = null
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
    upload: async (stream, outputLocation) => {
      mockOutput[outputLocation] = await streamToString(stream)
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
  fetchConfig: async () => ({fulfilments: {homedelivery: {uploadFolder: ''}}})
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
            expect(expectedContents).toEqual(mockOutput[expectedFileName])
          })
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

test('should return error on missing query subscriptions query result for weekly', done => {
  let input = {
    type: 'weekly',
    deliveryDate: '2017-07-06',
    results: [
      {
        queryName: 'WeeklyHolidaySuspensions',
        fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv'
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
    results: [
      {
        queryName: 'WeeklyHolidaySuspensions',
        fileName: 'WeeklyHolidaySuspensions_2017-07-06.csv'
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
      }
    ]
  }
  let expectedFileName = '2017-07-06_WEEKLY_United_Kingdom.csv'
  let expectedResponse = {...input, 'fulfilmentFile': expectedFileName}

  handler(input, {}, verify(done, null, expectedResponse, [expectedFileName]))
  done()
})
