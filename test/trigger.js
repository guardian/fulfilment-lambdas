import { getHandler } from './../src/fulfilmentTrigger'

import test from 'ava'

let fakeDependencies = {
  triggerFulfilmentFor: function (date) {
    return Promise.resolve({ok: 'ok'})
  },
  fetchConfig: function () {
    return Promise.resolve({
      triggerLambda: {expectedToken: 'testToken'}
    })
  }
}

function getFakeInput(token, date, amount) {
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
  body.message = JSON.stringify(message)
  headers['Content-Type'] = 'application/json'
  res.body = body
  res.headers = headers
  res.statusCode = status
  return res
}

function assertExpectedResponse(test, expected) {
  return function (err, res) {
    if (err){
      let errDesc= JSON.stringify(err)
      test.fail(`Unexpected error Response ${errDesc}`)
      return
    }
    test.deepEqual(res, expected)
    test.end()
  }
}
//TODO THIS SHOULD RETURN ANOTHER STATUS CODE
test.cb('should return error if wrong api token', t => {
  let handle = getHandler(fakeDependencies)
  t.plan(1)
  let wrongTokenInput = getFakeInput('wrongToken', '2017-06-12', 1)
  handle(wrongTokenInput, {}, assertExpectedResponse(t, errorResponse("500", "Unexpected server error")))

})
test.cb('should return 400 error required parameters are missing', t => {
  let handle = getHandler(fakeDependencies)
  t.plan(1)
  let emptyRequest = { body:"{}"}
  handle(emptyRequest, {}, assertExpectedResponse(t, errorResponse("400", "missing amount or date")))
})
test.cb('should return 400 error no api token is provided', t => {
  let handle = getHandler(fakeDependencies)
  t.plan(1)
  let noApiToken = { headers:{}, body:"{\"date\":\"2017-01-02\", \"amount\":1}"}
  handle(noApiToken, {}, assertExpectedResponse(t, errorResponse("400", "ApiToken header missing")))
})
test.cb('should return 400 error if too many days in request', t => {
  let handle = getHandler(fakeDependencies)
  t.plan(1)
  let tooManyDaysInput = getFakeInput('wrongToken', '2017-06-12', 21)
  handle(tooManyDaysInput, {}, assertExpectedResponse(t, errorResponse("400", "amount should be a number between 1 and 5")))

})
