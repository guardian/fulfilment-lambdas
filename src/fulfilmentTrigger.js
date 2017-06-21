import {fetchConfig} from './config'
import request from 'request'
import moment from 'moment'
import AWS from 'aws-sdk'


const stepfunctions = new AWS.StepFunctions();
const DATE_FORMAT = "YYYY-MM-DD"
const BAD_REQUEST = 400
const UNAUTHORIZED = 401
function getParams (date) {
  let params = {}
  params.stateMachineArn = process.env.StateMachine
  params.input = `{"deliveryDate" : "${date}"}`
  console.log(params)
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

function triggerFulfilmentFor(date: String) {
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

function triggerLambdas (startDate, amount) {
  let results = range(amount).map(offset => {
      let date = moment(startDate, DATE_FORMAT).add(offset, 'days').format(DATE_FORMAT)
      return triggerFulfilmentFor(date)
    }
  )
  return Promise.all(results)
}

function range (amount) {
  let resArray = []
  for (var i = 0; i < amount; i++) {
    resArray.push(i)
  }
  return resArray
}



export function handler (input, context, callback) {
  console.log(input)
  let body = JSON.parse(input.body)
  if (!body.amount || !body.date) {
    callback(null, getErrorResponse(BAD_REQUEST, 'missing amount or date'))
  }
  if (body.amount < 1 || body.amount > 10) {
    callback(null, getErrorResponse(BAD_REQUEST, 'amount should be a number between 1 and 10'))
  }
  let providedToken = input.headers.apiToken
  if (!providedToken){
    callback(null, getErrorResponse(BAD_REQUEST, 'ApiToken missing from request'))

  }
  asyncHandler(body.date, body.amount, providedToken)
    .then(res => {
      console.log(res)
      callback(null, okRes)
    })
    .catch(error => {
      console.log(error)
      callback(serverError)
    })
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

async function asyncHandler (startDate, amount, providedToken) {
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  await validateToken(config.triggerLambda.expectedToken, providedToken)
  console.log("token validated successfully")
  return triggerLambdas(startDate, amount)

}
