import { getHandler } from '../src/fulfilmentTrigger'
const mockFn = jest.fn()
function getFakeDependencies () {

  let fulfilmentTrigger = jest.fn(() => Promise.resolve({ok: 'ok'}))
  let fetchConfig = jest.fn(() => Promise.resolve({triggerLambda: {expectedToken: 'testToken'}}))
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
function verify (done, fakeDeps, expectedResponse, expectedFulfilmentDays) {
  return function (err, res) {
    if (err) {
      let errDesc = JSON.stringify(err)
      test.fail(`Unexpected error Response ${errDesc}`)
      return
    }
    let responseAsJson = JSON.parse(JSON.stringify(res))
    try {
      expect(responseAsJson).toEqual(expectedResponse)

      expect(fakeDeps.triggerFulfilmentFor.mock.calls.length).toBe(expectedFulfilmentDays.length)

      expectedFulfilmentDays.forEach(function(date){
        expect(fakeDeps.triggerFulfilmentFor).toBeCalledWith(date);
      })
      done()
    }
    catch(error) {
      done.fail(error)
    }
  }
}


test('should return error if api token is wrong', done => {
  let deps = getFakeDependencies()
  let handle = getHandler(deps)

  let wrongTokenInput = getFakeInput('wrongToken', '2017-06-12', 1)

  let expectedResponse = errorResponse('401', 'Unauthorized')
  let expectedFulfilmentDates = []
  handle(wrongTokenInput, {}, verify(done, deps,expectedResponse , expectedFulfilmentDates))
});

  test('should return 400 error required parameters are missing', done => {
    let deps = getFakeDependencies()
    let handle = getHandler(deps)
    let emptyRequest = {body: '{}'}
    let expectedResponse = errorResponse('400', 'missing amount or date')
    let expectedFulfilments = []
    handle(emptyRequest, {}, verify(done, deps, expectedResponse, expectedFulfilments))
  })
  test('should return 400 error no api token is provided', done => {
    let deps = getFakeDependencies()
    let handle = getHandler(deps)
    let noApiToken = {headers: {}, body: '{"date":"2017-01-02", "amount":1}'}
    let expectedFulfilments = []
    let expectedResponse =  errorResponse('400', 'ApiToken header missing')
    handle(noApiToken, {}, verify(done, deps,expectedResponse, expectedFulfilments))
  })
  test('should return 400 error if too many days in request', done => {
    let deps = getFakeDependencies()
    let handle = getHandler(deps)
    let tooManyDaysInput = getFakeInput('testToken', '2017-06-12', 21)
    let expectedResponse = errorResponse('400', 'amount should be a number between 1 and 5')
    let expectedFulfilments = []
    handle(tooManyDaysInput, {}, verify(done, deps, expectedResponse, expectedFulfilments))

  })
  test('should return 200 status and trigger fulfilment on success', done => {
    let deps = getFakeDependencies()
    let handle = getHandler(deps)
    let input = getFakeInput('testToken', '2017-06-12', 2)
    let successResponse = {
      'statusCode': '200',
      'headers': {
        'Content-Type': 'application/json'
      },
      'body': '{"message":"ok"}'
    }
    let expectedFulfilments = ['2017-06-12', '2017-06-13']
    handle(input, {}, verify(done, deps, successResponse, expectedFulfilments))

  })