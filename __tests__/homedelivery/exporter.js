/* eslint-env jest */
import { handler } from '../../src/exporter'
var MockDate = require('mockdate')

// mock current date
MockDate.set('7/5/2017')

jest.mock('../../src/lib/storage', () => {
  const fs = require('fs')
  return {
    upload: async (stringSource, outputLocation) => outputLocation,
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
  await expect(handler(input, {})).rejects.toThrow()
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
  await expect(handler(input, {})).rejects.toThrow()
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
  await expect(handler(input, {})).resolves.toEqual(expectedResponse)
})
