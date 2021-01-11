// @flow
import * as csv from 'fast-csv';
import moment from 'moment';
import { createReadStream, upload } from './../lib/storage';
import { ReadStream } from 'fs';
import { fetchConfig, getStage } from './../lib/config';
import { generateFilename } from './../lib/Filename';
import getStream from 'get-stream';
import type { Input, result } from '../exporter';

// input headers
const IDENTITY_ID = 'Identity Id'
const RATEPLAN_NAME = 'RatePlan name'
const RATEPLAN_CHARGE_NAME = 'RatePlanCharge name'
const TERM_END_DATE = 'TermEndDate'

const outputHeaders = [IDENTITY_ID, RATEPLAN_NAME, RATEPLAN_CHARGE_NAME, TERM_END_DATE]
const SUBSCRIPTIONS_QUERY_NAME = 'Subscriptions'

function getDownloadStream (results: Array<result>, stage: string, queryName: string): Promise<ReadStream> {
  function getFileName (queryName) {
    function isTargetQuery (result) {
      return result.queryName === queryName
    }

    const filtered = results.filter(isTargetQuery)

    if (filtered.length !== 1) {
      return null // not sure if there are options in js
    } else {
      return filtered[0].fileName
    }
  }

  return new Promise((resolve, reject) => {
    console.log(`getting results file for query: ${queryName}`)
    const fileName = getFileName(queryName)
    if (!fileName) {
      reject(new Error(`Invalid input cannot find unique query called ${queryName}`))
      return
    }
    const path = `zuoraExport/${fileName}`
    resolve(createReadStream(path))
  })
}

/**
 *  Transforms raw CSV from Zuora to expected CSV format, and uploads it to S3 under members_data_api_output folder.
 *
 * @param downloadStream raw Home Delivery CSV exported from Zuora
 * @param deliveryDate
 * @param stage
 * @returns {Promise<string>} the filename of result CSV in new format
 */
async function processSubs (downloadStream: ReadStream, deliveryDate: moment, stage: string): Promise<string> {
  const config = await fetchConfig()
  const folder = config.fulfilments.membersDataApi

  const csvFormatterStream = csv.format({ headers: outputHeaders, quoteColumns: true })

  const writeRowToCsvStream = (row, csvStream) => {
    const outputCsvRow = {}
    outputCsvRow[IDENTITY_ID] = row['Account.IdentityId']
    outputCsvRow[RATEPLAN_NAME] = row['RatePlan.Name']
    outputCsvRow[RATEPLAN_CHARGE_NAME] = row['RateplanCharge.Name']
    outputCsvRow[TERM_END_DATE] = row['Subscription.TermEndDate']
    csvStream.write(outputCsvRow)
  }

  const writableCsvPromise =
    new Promise((resolve, reject) => {
      downloadStream
        .pipe(csv.parse({ headers: true }))
        .on('error', error => {
          console.log('Failed to write members-data-api CSV: ', error)
          reject(Error(error))
        })
        .on('data', row => writeRowToCsvStream(row, csvFormatterStream))
        .on('end', rowCount => {
          console.log(`Successfully written ${rowCount} rows`)
          csvFormatterStream.end()
          resolve(csvFormatterStream)
        })
    })

  const outputFileName = generateFilename(deliveryDate, 'MEMBERS_DATA_API')
  const stream = await writableCsvPromise
  /**
   * WARNING: Although AWS S3.upload docs seem to indicate we can upload a stream object directly via
   * 'Body: stream' params field, it does not seem to work with the stream provided by csv-parser,
   * thus we had to convert the stream to string using get-stream package.
   */
  const streamAsString = await getStream(stream)
  await upload(streamAsString, outputFileName, folder)
  return outputFileName.filename
}

function getDeliveryDate (input: Input): Promise<moment> {
  return new Promise((resolve, reject) => {
    const deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD')
    if (deliveryDate.isValid()) {
      resolve(deliveryDate)
    } else {
      reject(new Error('invalid deliverydate expected format YYYY-MM-DD'))
    }
  })
}

export async function membersDataApiExport (input: Input) {
  const stage = await getStage()
  const deliveryDate = await getDeliveryDate(input)
  const subscriptionsStream = await getDownloadStream(input.results, stage, SUBSCRIPTIONS_QUERY_NAME)
  return await processSubs(subscriptionsStream, deliveryDate, stage)
}
