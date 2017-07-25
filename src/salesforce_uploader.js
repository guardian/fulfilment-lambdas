// @flow

import { fetchConfig } from './lib/config'
import { authenticate } from './lib/salesforceAuthenticator'
import { getObject, copyObject } from './lib/storage'
import { ApiResponse, SuccessResponse, serverError, unauthorizedError, badRequest } from './ApiResponse'

import moment from 'moment'

const DATE_FORMAT = 'YYYY-MM-DD'
const MAX_DAYS = 5

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

async function copyToUploadedFolder (stage, s3Path, sfFileName) {
  try {
    let uploadedPath = `${stage}/uploaded/${sfFileName}`
    await
      copyObject(s3Path, uploadedPath)
  } catch (err) {
    console.error('error copying fulfilment file to uploaded directory')
    console.log(err)
  }
}

export function handler (input: apiGatewayLambdaInput, context: any, callback: (error: any, apiResponse: ApiResponse) => void) {
  function validationError (message) {
    console.log(message)
    callback(null, badRequest(message))
  }

  async function salesforceUpload (fileData, stage, salesforce, sfFolder) {
    let dayOfTheWeek = fileData.date.format('dddd')
    let dateSuffix = fileData.date.format('DD_MM_YYYY')
    let outputFileName = `HOME_DELIVERY_${dayOfTheWeek}_${dateSuffix}.csv`
    console.log(`uploading ${outputFileName} to ${sfFolder.name}`)
    let uploadResult = await salesforce.uploadDocument(outputFileName, sfFolder, fileData.file.Body)
    await copyToUploadedFolder(stage, fileData.s3Path, outputFileName)
    return Promise.resolve({
      name: outputFileName,
      id: uploadResult.id
    })
  }

  async function getFileData (stage, date) {
    let s3FileName = date.format(DATE_FORMAT) + '_HOME_DELIVERY.csv'
    let s3Path = `${stage}/fulfilment_output/${s3FileName}`
    try {
      let file = await getObject(s3Path)
      return Promise.resolve({
        s3Path: s3Path,
        file: file,
        date: date
      })
    } catch (err) {
      console.log('error from  S3:')
      console.log(err)
      if (err.code === 'NoSuchKey') {
        throw badRequest('requested files not found')
      } else throw err
    }
  }

  async function asyncHandler (startDate, amount, providedToken) {
    let config = await fetchConfig()
    console.log('Config fetched successfully.')
    await validateToken(config.api.expectedToken, providedToken)
    console.log('token validated successfully')
    const salesforce = await authenticate(config)
    console.log('Finding fulfilment folder.')
    const folder = config.salesforce.uploadFolder
    console.log(folder)

    let filePromises = range(amount).map(offset => {
      let date = moment(startDate, DATE_FORMAT).add(offset, 'days')
      return getFileData(config.stage, date)
    })

    let files = await Promise.all(filePromises)

    let results = files.map(fileData => {
      return salesforceUpload(fileData, config.stage, salesforce, folder)
    })

    return Promise.all(results)
  }

  let body = JSON.parse(input.body)
  if (!body.amount || !body.date) {
    validationError('missing amount or date')
    return
  }
  if (body.amount < 1 || body.amount > MAX_DAYS) {
    validationError(`amount should be a number between 1 and ${MAX_DAYS}`)
    return
  }
  let providedToken = input.headers.apiToken
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
