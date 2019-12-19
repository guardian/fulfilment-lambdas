/* eslint-env jest */

import { handler } from '../../src/querier'
var MockDate = require('mockdate')

// mock current date
MockDate.set('7/5/2017')
jest.mock('../../src/lib/config', () => {
  const fakeResponse = {
    zuora: {
      api: {
        url: 'http://fake-zuora-utl.com',
        username: 'fakeUser',
        password: 'fakePass'
      }
    },
    stage: 'CODE'
  }
  return {
    fetchConfig: jest.fn(() => Promise.resolve(fakeResponse))
  }
})

jest.mock('request', () => {
  return function (options, callback) {
    const response = {
      statusCode: 200
    }
    const body = {
      id: 'someId'
    }
    // TODO SEE IF WE CAN VERIFY SOMETHING ABOUT THE QUERIES HERE!
    callback(null, response, body)
  }
})

function verify (done, expectedError, expectedResponse) {
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
      done()
    } catch (error) {
      done.fail(error)
    }
  }
}

test('should return error if missing delivery date and deliveryDateDaysFromNow ', done => {
  const input = { type: 'homedelivery' }
  const expectedError = new Error('deliveryDate or deliveryDateDaysFromNow input param must be provided')

  handler(input, {}, verify(done, expectedError, null))
})

test('should return error if delivery date is in the wrong format', done => {
  const input = {
    deliveryDate: 'wrong format', type: 'homedelivery'
  }
  const expectedError = Error('deliveryDate must be in the format "YYYY-MM-DD"')

  handler(input, {}, verify(done, expectedError, null))
})

test('should query zuora for specific date', done => {
  const input = {
    deliveryDate: '2017-07-06', type: 'homedelivery'
  }
  const expectedResponse = { ...input, jobId: 'someId' }
  handler(input, {}, verify(done, null, expectedResponse))
})

test('should query zuora for daysFromNow', done => {
  const input = {
    deliveryDateDaysFromNow: 5, type: 'homedelivery'
  }
  const expectedResponse = { ...input, deliveryDate: '2017-07-10', jobId: 'someId' }
  handler(input, {}, verify(done, null, expectedResponse))
})
