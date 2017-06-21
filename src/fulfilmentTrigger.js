import {fetchConfig} from './config'
import request from 'request'
import moment from 'moment'
import AWS from 'aws-sdk'


const stepfunctions = new AWS.StepFunctions();
const DATE_FORMAT = "YYYY-MM-DD"
const BAD_REQUEST = 400
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

function range(amount) {
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
    callback(null, getErrorResponse(BAD_REQUEST, "missing amount or date"))
  }
  if (body.amount < 1 || body.amount >10) {
    callback(null, getErrorResponse(BAD_REQUEST, "amount should be a number between 1 and 10"))
  }

   let results = range(body.amount).map(offset => {
       let date = moment(body.date, DATE_FORMAT).add(offset, "days").format(DATE_FORMAT)
       return triggerFulfilmentFor(date)
     }
   )
  Promise.all(results)
    .then(res => {
      console.log(res)
      callback(null, okRes)
    })
    .catch(error => callback(serverError))
}
