import { fetchConfig } from './lib/config'
import request from 'request'
import moment from 'moment'
import AWS from 'aws-sdk'
const stepfunctions = new AWS.StepFunctions()
const DATE_FORMAT = 'YYYY-MM-DD'
const BAD_REQUEST = '400'
const MAX_DAYS = 5
function getParams (date) {
  let params = {}
  params.stateMachineArn = process.env.StateMachine
  params.input = `{"deliveryDate" : "${date}"}`
  return params
}

class ApiResponse {
  constructor (status, message) {
    this['statusCode'] = status
    let body = {'message': message}
    this.body = JSON.stringify(body)
    this.headers = {'Content-Type': 'application/json'}
  }
}
let okResponse = new ApiResponse('200', 'ok')
let serverError = new ApiResponse('500', 'Unexpected server error')
let unauthorizedError = new ApiResponse('401', "Unauthorized")

function range (amount) {
  let resArray = []
  for (var i = 0; i < amount; i++) {
    resArray.push(i)
  }
  return resArray
}

function validateToken (expectedToken, providedToken) {
  return new Promise((resolve, reject) => {
    if (expectedToken == providedToken) {
      resolve()
    }
    else {
      console.log('failed token authentication')
      reject(unauthorizedError)
    }
  })
}

export function getHandler (dependencies) {
  return function handle (input, context, callback) {

    function returnError (status, message) {
      console.log(message)
      callback(null, new ApiResponse(status, message))
    }

    function triggerLambdas (startDate, amount) {
      let results = range(amount).map(offset => {
          let date = moment(startDate, DATE_FORMAT).add(offset, 'days').format(DATE_FORMAT)
          return dependencies.triggerFulfilmentFor(date)
        }
      )
      return Promise.all(results)
    }

    async function asyncHandler (startDate, amount, providedToken) {
      let config = await dependencies.fetchConfig()
      console.log('Config fetched succesfully.')
      await validateToken(config.triggerLambda.expectedToken, providedToken)
      console.log('token validated successfully')
      return triggerLambdas(startDate, amount)
    }

    let body = JSON.parse(input.body)
    if (!body.amount || !body.date) {
      returnError(BAD_REQUEST, 'missing amount or date')
      return
    }
    if (body.amount < 1 || body.amount > MAX_DAYS) {
      returnError(BAD_REQUEST, `amount should be a number between 1 and ${MAX_DAYS}`)
      return
    }
    let providedToken = input.headers.apiToken
    if (!providedToken) {
      returnError(BAD_REQUEST, 'ApiToken header missing')
      return
    }

    asyncHandler(body.date, body.amount, providedToken)
      .then(res => {
        console.log("returning success api response")
        callback(null, okResponse)
      })
      .catch(error => {
        console.log(error)
        if (error instanceof ApiResponse) {
          callback(null, error)
        }
        else {
          callback(null, serverError)
        }
      })
  }
}

function triggerFulfilmentForDate (date: String) {
  return new Promise((resolve, reject) => {
    stepfunctions.startExecution(getParams(date), function (err, data) {
      if (err) {
        console.log(err, err.stack)
        reject(err)
      }
      else {
        resolve(data)
      }
    })
  })
}

export function handler (input, context, callback) {
  getHandler({
    fetchConfig: fetchConfig,
    triggerFulfilmentFor: triggerFulfilmentForDate
  })(input, context, callback)
}


