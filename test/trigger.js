import { getHandler } from './../src/fulfilmentTrigger'
import test from 'ava'
import sinon from 'sinon'

function getFakeDependencies () {
  let fulfilmentTrigger = sinon.stub().returns(Promise.resolve({ok: 'ok'}))
  let fetchConfig = sinon.stub().returns(Promise.resolve({triggerLambda: {expectedToken: 'testToken'}}))
  return {
    triggerFulfilmentFor: fulfilmentTrigger,
    fetchConfig: fetchConfig
  }
}


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

function getCallback (test) {
  return function (err, res) {
    if (err) {
      test.fail(err)
    }
    else {
      test.pass()
    }
    test.end()
  }
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
function verify (test, fakeDeps, expectedResponse, expectedFulfilmentDays) {
  return function (err, res) {
    if (err) {
      let errDesc = JSON.stringify(err)
      test.fail(`Unexpected error Response ${errDesc}`)
      return
    }
    let responseAsJson = JSON.parse(JSON.stringify(res))
    test.deepEqual(responseAsJson, expectedResponse)
    test.deepEqual(fakeDeps.triggerFulfilmentFor.callCount, expectedFulfilmentDays.length, 'Unexpected number of calls to trigger fulfilment')

    let allDates = new Set()
    expectedFulfilmentDays.forEach(function(date){
      test.true(fakeDeps.triggerFulfilmentFor.calledWith(date),`Fulfilment not triggered for ${date}` )
    })
    test.end()
  }
}
test.cb('should return error if wrong api token', t => {

  let deps = getFakeDependencies()
  let handle = getHandler(deps)

  let wrongTokenInput = getFakeInput('wrongToken', '2017-06-12', 1)

  let expectedResponse = errorResponse('401', 'Unauthorized')
  let expectedFulfilmentDates = []
  handle(wrongTokenInput, {}, verify(t, deps,expectedResponse , expectedFulfilmentDates))

})
test.cb('should return 400 error required parameters are missing', t => {
  let deps = getFakeDependencies()
  let handle = getHandler(deps)
  let emptyRequest = {body: '{}'}
  let expectedResponse = errorResponse('400', 'missing amount or date')
  let expectedFulfilments = []
  handle(emptyRequest, {}, verify(t,deps, expectedResponse, expectedFulfilments))
})
test.cb('should return 400 error no api token is provided', t => {
  let deps = getFakeDependencies()
  let handle = getHandler(deps)
  let noApiToken = {headers: {}, body: '{"date":"2017-01-02", "amount":1}'}
  let expectedFulfilments = []
  let expectedResponse =  errorResponse('400', 'ApiToken header missing')
  handle(noApiToken, {}, verify(t,deps,expectedResponse, expectedFulfilments))
})
test.cb('should return 400 error if too many days in request', t => {
  let deps = getFakeDependencies()
  let handle = getHandler(deps)
  let tooManyDaysInput = getFakeInput('testToken', '2017-06-12', 21)
  let expectedResponse = errorResponse('400', 'amount should be a number between 1 and 5')
  let expectedFulfilments = []
  handle(tooManyDaysInput, {}, verify(t,deps, expectedResponse, expectedFulfilments))

})
test.cb('should return 200 status on success', t => {
  let deps = getFakeDependencies()
  let handle = getHandler(deps)
  let tooManyDaysInput = getFakeInput('testToken', '2017-06-12', 2)
  let successResponse = {
    'statusCode': '200',
    'headers': {
      'Content-Type': 'application/json'
    },
    'body': '{"message":"ok"}'
  }
  let expectedFulfilments = ['2017-06-12', '2017-06-13']
  handle(tooManyDaysInput, {}, verify(t,deps, successResponse, expectedFulfilments))

})