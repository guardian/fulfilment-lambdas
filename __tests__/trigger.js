/* eslint-env jest */

import { handle } from '../src/fulfilmentTrigger'

jest.mock('../src/lib/TriggerStateMachine', () => {
  return {
    triggerStateMachine: jest.fn(() => Promise.resolve({ok: 'ok'}))
  }
})

jest.mock('../src/lib/config', () => {
  let fakeResponse = {
    triggerLambda: {
      expectedToken: 'testToken'
    }
  }
  return {
    fetchConfig: jest.fn(() => Promise.resolve(fakeResponse))
  }
})

let fakeMod = require('../src/lib/TriggerStateMachine')
let fulfilmentTrigger = fakeMod.triggerStateMachine

let fakeStateMachineArn = 'StateMachineARN'
process.env.StateMachine = fakeStateMachineArn

function getFakeInput (token, date, amount) {
  let res = {}
  let headers = {}
  headers.apiToken = token
  let body = {}
  body.date = date
  body.amount = amount
  res.headers = headers
  res.body = JSON.stringify(body)
  return res
}

function errorResponse (status, message) {
  let res = {}
  let body = {}
  let headers = {}
  body.message = message
  headers['Content-Type'] = 'application/json'
  res.body = JSON.stringify(body)
  res.headers = headers
  res.statusCode = status
  return res
}
function verify (done, expectedResponse, expectedFulfilmentDays) {
  return function (err, res) {
    if (err) {
      let errDesc = JSON.stringify(err)
      test.fail(`Unexpected error Response ${errDesc}`)
      return
    }
    let responseAsJson = JSON.parse(JSON.stringify(res))
    try {
      expect(responseAsJson).toEqual(expectedResponse)

      expect(fulfilmentTrigger.mock.calls.length).toBe(expectedFulfilmentDays.length)

      expectedFulfilmentDays.forEach(function (date) {
        expect(fulfilmentTrigger).toHaveBeenCalledWith(`{"deliveryDate" : "${date}"}`, fakeStateMachineArn)
      })
      done()
    } catch (error) {
      done.fail(error)
    }
  }
}

beforeEach(() => {
  fulfilmentTrigger.mock.calls = []
})

test('should return error if api token is wrong', done => {
  let wrongTokenInput = getFakeInput('wrongToken', '2017-06-12', 1)
  let expectedResponse = errorResponse('401', 'Unauthorized')
  let expectedFulfilmentDates = []
  handle(wrongTokenInput, {}, verify(done, expectedResponse, expectedFulfilmentDates))
})

test('should return 400 error required parameters are missing', done => {
  let emptyRequest = {body: '{}'}
  let expectedResponse = errorResponse('400', 'missing amount or date')
  let expectedFulfilments = []
  handle(emptyRequest, {}, verify(done, expectedResponse, expectedFulfilments))
})
test('should return 400 error no api token is provided', done => {
  let noApiToken = {headers: {}, body: '{"date":"2017-01-02", "amount":1}'}
  let expectedFulfilments = []
  let expectedResponse = errorResponse('400', 'ApiToken header missing')
  handle(noApiToken, {}, verify(done, expectedResponse, expectedFulfilments))
})
test('should return 400 error if too many days in request', done => {
  let tooManyDaysInput = getFakeInput('testToken', '2017-06-12', 21)
  let expectedResponse = errorResponse('400', 'amount should be a number between 1 and 5')
  let expectedFulfilments = []
  handle(tooManyDaysInput, {}, verify(done, expectedResponse, expectedFulfilments))
})
test('should return 200 status and trigger fulfilment on success', done => {
  let input = getFakeInput('testToken', '2017-06-12', 2)
  let successResponse = {
    'statusCode': '200',
    'headers': {
      'Content-Type': 'application/json'
    },
    'body': '{"message":"ok"}'
  }
  let expectedFulfilments = ['2017-06-12', '2017-06-13']
  handle(input, {}, verify(done, successResponse, expectedFulfilments))
})

test('should return error if api token is wrong', done => {
  let wrongTokenInput = getFakeInput('wrongToken', '2017-06-12', 1)
  let expectedResponse = errorResponse('401', 'Unauthorized')
  let expectedFulfilmentDates = []
  handle(wrongTokenInput, {}, verify(done, expectedResponse, expectedFulfilmentDates))
})