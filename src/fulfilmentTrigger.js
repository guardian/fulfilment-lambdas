
import {fetchConfig} from './config'
import request from 'request'
import moment from 'moment'
import AWS from 'aws-sdk'
const stepfunctions = new AWS.StepFunctions()
const DATE_FORMAT = "YYYY-MM-DD"
const BAD_REQUEST = 400
const UNAUTHORIZED = 401
const MAX_DAYS = 5
function getParams (date) {
  let params = {}
  params.stateMachineArn = process.env.StateMachine
  params.input = `{"deliveryDate" : "${date}"}`
  return params
}

let okRes = {
  'statusCode': '200',
  'headers': {
    'Content-Type': 'application/json'
  },
  'body': 'ok'
}

function getErrorResponse (status, message) {
  let res = {}
  res.statusCode = status
  res.headers = {'Content-Type': 'application/json'}
  res.body = {}
  res.body.message = message
  return res
}

let serverError = getErrorResponse(500, "Unexpected server error")



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
      console.log("failed token authentication")
      //TODO RETURN STATUS 401 IF THIS HAPPENS
      reject('invalid token')
    }
  })
}


export function getHandler (dependencies) {
  return function handle (input, context, callback) {

    function returnError(status, message) {
      console.log(message)
      callback(null, getErrorResponse(BAD_REQUEST, message))
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
      console.log("token validated successfully")
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
        console.log(res)
        callback(null, okRes)
      })
      .catch(error => {
        console.log(error)
        callback(null, serverError)
      })
  }
}

function triggerFulfilmentForDate(date: String) {
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
//todo see if there is a nicer way of doing this
export function handler(input, context, callback) {
  getHandler({
    fetchConfig: fetchConfig,
    triggerFulfilmentFor: triggerFulfilmentForDate
  })(input, context, callback)
}


