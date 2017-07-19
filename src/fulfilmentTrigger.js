// @flow

import { fetchConfig } from './lib/config'
import { authenticate } from './lib/salesforceAuthenticator'
import { getObject } from './lib/storage'

import moment from 'moment'
const DATE_FORMAT = 'YYYY-MM-DD'
const BAD_REQUEST = '400'
const MAX_DAYS = 5

class ApiResponse {
  body: string
  statusCode: string
  headers: { 'Content-Type': string }

  constructor (status, message) {
    let body = {'message': message}
    this.body = JSON.stringify(body)
    this.statusCode = status
    this.headers = {'Content-Type': 'application/json'}
  }
}
let okResponse = new ApiResponse('200', 'ok')
let serverError = new ApiResponse('500', 'Unexpected server error')
let unauthorizedError = new ApiResponse('401', 'Unauthorized')

function range (amount) {
  let resArray = []
  for (var i = 0; i < amount; i++) {
    resArray.push(i)
  }
  return resArray
}

function validateToken (expectedToken, providedToken) {
  return new Promise((resolve, reject) => {
    if (expectedToken === providedToken) {
      resolve()
    } else {
      console.log('failed token authentication')
      reject(unauthorizedError)
    }
  })
}
type inputHeaders = {
  apiToken ?: string
}
type apiGatewayLambdaInput = {
  body: string,
  headers: inputHeaders

}
export function handler (input: apiGatewayLambdaInput, context: any, callback: (error: any, apiResponse: ApiResponse) => void) {
  function returnError (status, message) {
    console.log(message)
    callback(null, new ApiResponse(status, message))
  }

  async function uploadFileFor (date, stage, salesforce, sfFolder) {
    let s3FileName = date.format(DATE_FORMAT) + '_HOME_DELIVERY.csv'
    let s3Path = `${stage}/fulfilment_output/${s3FileName}`
    let fileToUpload = await getObject(s3Path)

    let dayOfTheWeek = date.format('dddd')
    let dateSuffix = date.format('DD_MM_YYYY')
    let outputFileName = `HOME_DELIVERY_${dayOfTheWeek}_${dateSuffix}.csv`
    console.log(`uploading ${outputFileName} to ${sfFolder.name}`)
    return salesforce.uploadDocument(outputFileName, sfFolder, fileToUpload.Body)
  }

  async function asyncHandler (startDate, amount, providedToken) {
    let config = await fetchConfig()
    console.log('Config fetched successfully.')
    await validateToken(config.triggerLambda.expectedToken, providedToken)
    console.log('token validated successfully')
    const salesforce = await authenticate(config)
    console.log('Finding fulfilment folder.')
    const folder = config.salesforce.uploadFolder
    console.log(folder)

    let results = range(amount).map(offset => {
      let date = moment(startDate, DATE_FORMAT).add(offset, 'days')
      return uploadFileFor(date, config.stage, salesforce, folder)
    })
    return Promise.all(results)
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
      console.log('returning success api response')
      callback(null, okResponse)
    })
    .catch(error => {
      console.log(error)
      if (error instanceof ApiResponse) {
        callback(null, error)
      } else {
        callback(null, serverError)
      }
    })
}
