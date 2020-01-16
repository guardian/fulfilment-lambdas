// @flow

import { fetchConfig } from './lib/config'
import { authenticate } from './lib/salesforceAuthenticator'
import { getObject, copyObject } from './lib/storage'
import { ApiResponse, SuccessResponse, serverError, unauthorizedError, badRequest } from './lib/ApiResponse'

import moment from 'moment'

const DATE_FORMAT = 'YYYY-MM-DD'
const MAX_DAYS = 5

function range (amount: number) {
  const resArray = []
  for (var i = 0; i < amount; i++) {
    resArray.push(i)
  }
  return resArray
}

function validateToken (expectedToken: string, providedToken: string) {
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

async function copyToUploadedFolder (stage, s3Path, sfFileName) {
  try {
    const uploadedPath = `uploaded/${sfFileName}`
    await
    copyObject(s3Path, uploadedPath)
  } catch (err) {
    console.error('error copying fulfilment file to uploaded directory')
    console.log(err)
  }
}

/**
 *  Example input:
 *    Header: apiToken:*********
 *    Body: { "date":"2020-01-10",  "amount":1}
 *
 *  The apiToken is specified in fulfilment.private.json under expectedToken.
 *  FIXME: Why not just use API Gateway provided API Keys?
 */
export function handler (input: apiGatewayLambdaInput, context: any, callback: (error: any, apiResponse: ApiResponse) => void) {
  function validationError (message) {
    console.log(message)
    callback(null, badRequest(message))
  }

  async function salesforceUpload (fileData, stage, salesforce, sfFolder) {
    const dayOfTheWeek = fileData.date.format('dddd')
    const dateSuffix = fileData.date.format('DD_MM_YYYY')
    const outputFileName = `HOME_DELIVERY_${dayOfTheWeek}_${dateSuffix}.csv`
    console.log(`uploading ${outputFileName} to ${sfFolder.name}`)
    const sfFileDescription = `Home Delivery fulfilment file ${outputFileName}`
    const uploadResult = await salesforce.uploadDocument(outputFileName, sfFolder, sfFileDescription, fileData.file.Body)
    const lastModified = moment(fileData.file.LastModified).format('YYYY-MM-DD')
    await copyToUploadedFolder(stage, fileData.s3Path, outputFileName)
    return Promise.resolve({
      name: outputFileName,
      id: uploadResult.id,
      lastModified: lastModified
    })
  }

  async function getFileData (stage, date) {
    const s3FileName = date.format(DATE_FORMAT) + '_HOME_DELIVERY.csv'
    const s3Path = `fulfilment_output/${s3FileName}`
    const file = await getObject(s3Path)
    return Promise.resolve({
      s3Path: s3Path,
      file: file,
      date: date
    })
  }

  async function asyncHandler (startDate, amount, providedToken) {
    const config = await fetchConfig()
    console.log('Config fetched successfully.')
    await validateToken(config.api.expectedToken, providedToken)
    console.log('token validated successfully')
    const salesforce = await authenticate(config)
    console.log('Finding fulfilment folder.')
    const folder = config.fulfilments.homedelivery.uploadFolder
    console.log(folder)

    const filePromises = range(amount).map(offset => {
      const date = moment(startDate, DATE_FORMAT).add(offset, 'days')
      return getFileData(config.stage, date)
    })

    const files = await Promise.all(filePromises)

    const results = files.map(fileData => {
      return salesforceUpload(fileData, config.stage, salesforce, folder)
    })

    return Promise.all(results)
  }

  const body = JSON.parse(input.body)
  if (!body.amount || !body.date) {
    validationError('missing amount or date')
    return
  }
  if (body.amount < 1 || body.amount > MAX_DAYS) {
    validationError(`amount should be a number between 1 and ${MAX_DAYS}`)
    return
  }
  const providedToken = input.headers.apiToken
  if (!providedToken) {
    validationError('ApiToken header missing')
    return
  }

  asyncHandler(body.date, body.amount, providedToken)
    .then(uploadedFiles => {
      console.log('returning success api response')
      callback(null, new SuccessResponse(uploadedFiles))
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
