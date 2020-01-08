/* eslint-env jest */
import { handler } from '../../src/exporter'
import { readFile } from 'fs'
var MockDate = require('mockdate')

let mockOutput = null
// mock current date
MockDate.set('7/5/2017')

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

beforeEach(() => {
  process.env.Stage = 'CODE'
  mockOutput = null
})

it('should return error on missing query subscriptions query result', async () => {
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
  expect.assertions(1)
  await expect(handler(input, {})).rejects.toEqual(expectedError)
})

it('should return error on invalid deliveryDate', async () => {
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
  expect.assertions(1)
  await expect(handler(input, {})).rejects.toEqual(expectedError)
})

it('should generate correct fulfilment file', async () => {
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
  expect.assertions(1)
  await expect(handler(input, {})).resolves.toEqual(expectedResponse)
})
