// @flow
import * as csv from 'fast-csv'
import moment from 'moment'
import MultiStream from 'multistream'
import { upload, createReadStream } from './../lib/storage'
import { ReadStream } from 'fs'
import { getStage, fetchConfig } from './../lib/config'
import { generateFilename } from './../lib/Filename'
import type { Filename } from './../lib/Filename'
import { WeeklyExporter, CaExporter, CaHandDeliveryExporter, USExporter, UpperCaseAddressExporter } from './WeeklyExporter'
import type { result, Input } from '../exporter'
import getStream from 'get-stream'

const SUBSCRIPTION_NAME = 'Subscription.Name'
const HOLIDAYS_QUERY_NAME = 'WeeklyHolidaySuspensions'
const SUBSCRIPTIONS_QUERY_NAME = 'WeeklySubscriptions'
const INTRODUCTORY_QUERY_NAME = 'WeeklyIntroductoryPeriods'

function getDownloadStream (results: Array<result>, stage: string, queryName: string): Promise<ReadStream> {
  function getFileName (queryName) {
    function isTargetQuery (result) {
      return result.queryName === queryName
    }

    const filtered = results.filter(isTargetQuery)
    console.log(results, '!')

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

function getHolidaySuspensions (downloadStream: ReadStream): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const suspendedSubs = new Set()
    downloadStream
      .pipe(csv.parse({ headers: true }))
      .on('error', error => {
        console.log('Failed to get HolidaySuspensions CSV: ', error)
        reject(Error(error))
      })
      .on('data', row => {
        const subName = row['Subscription.Name']
        suspendedSubs.add(subName)
      })
      .on('end', rowCount => {
        console.log(`Successfully write ${rowCount} rows`)
        resolve(suspendedSubs)
      })
  })
}

/**
 * Transfroms raw CSV from Zuora to expected CSV format, splits it per regions, and uploads it to S3 fulfilments folder.
 * FIXME: Rename fulfilments to something meaningful such as guardian_weekly!
 *
 * @param downloadStream raw Guardian Weekly CSV exported from Zuora
 * @param deliveryDate
 * @param stage
 * @param holidaySuspensions subscriptions to filter out from CSV
 * @returns {Promise<Filename[]>}
 */
async function processSubs (downloadStream: ReadStream, deliveryDate: moment, stage: string, holidaySuspensions: Set<string>): Promise<Array<Filename>> {
  const config = await fetchConfig()
  console.log('loaded ' + holidaySuspensions.size + ' holiday suspensions')
  const rowExporter = new WeeklyExporter('Rest of the world', deliveryDate, config.fulfilments.weekly.ROW.uploadFolder)

  const exporters = [
    new WeeklyExporter('United Kingdom', deliveryDate, config.fulfilments.weekly.UK.uploadFolder),
    new CaExporter('Canada', deliveryDate, config.fulfilments.weekly.CA.uploadFolder),
    new CaHandDeliveryExporter('Canada', deliveryDate, config.fulfilments.weekly.CAHAND.uploadFolder),
    new USExporter('United States', deliveryDate, config.fulfilments.weekly.US.uploadFolder),
    new UpperCaseAddressExporter('Australia', deliveryDate, config.fulfilments.weekly.AU.uploadFolder),
    new WeeklyExporter('France', deliveryDate, config.fulfilments.weekly.FR.uploadFolder),
    new UpperCaseAddressExporter('New Zealand', deliveryDate, config.fulfilments.weekly.NZ.uploadFolder),
    new WeeklyExporter('Hong Kong', deliveryDate, config.fulfilments.weekly.ROW.uploadFolder),
    new UpperCaseAddressExporter('Vanuatu', deliveryDate, config.fulfilments.weekly.VU.uploadFolder),
    rowExporter
  ]

  const writableCsvPromise =
    new Promise((resolve, reject) => {
      downloadStream
        .pipe(csv.parse({ headers: true }))
        .on('error', error => {
          console.log('ignoring invalid data: ', error)
          reject(Error(error))
        })
        .on('data', row => {
          const subscriptionName = row[SUBSCRIPTION_NAME]
          if (holidaySuspensions.has(subscriptionName)) return
          const selectedExporter = exporters.find(exporter => exporter.useForRow(row)) || rowExporter
          selectedExporter.processRow(row)
        })
        .on('end', rowCount => {
          console.log(`Successfully written ${rowCount} rows`)
          exporters.map(exporter => {
            exporter.end()
          })
          resolve()
        })
    })

  await writableCsvPromise
  const uploads = exporters.map(async (exporter) => {
    const outputFileName = generateFilename(deliveryDate, 'WEEKLY')
    /**
     * WARNING: Although AWS S3.upload docs seem to indicate we can upload a stream object directly via
     * 'Body: stream' params field, it does not seem to work with the stream provided by csv-parser,
     * thus we had to convert the stream to string using get-stream package.
     */
    const streamAsString = await getStream(exporter.writeCSVStream)
    await upload(streamAsString, outputFileName, exporter.folder)
    return outputFileName
  })
  return Promise.all(uploads)
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

export async function weeklyExport (input: Input) {
  const stage = await getStage()
  const deliveryDate = await getDeliveryDate(input)
  const holidaySuspensionsStream = await getDownloadStream(input.results, stage, HOLIDAYS_QUERY_NAME)
  const holidaySuspensions = await getHolidaySuspensions(holidaySuspensionsStream)
  const introductoryPeriodStream = await getDownloadStream(input.results, stage, INTRODUCTORY_QUERY_NAME)
  const NonIntroductorySubsStream = await getDownloadStream(input.results, stage, SUBSCRIPTIONS_QUERY_NAME)
  const subscriptionsStream = MultiStream([introductoryPeriodStream, NonIntroductorySubsStream])
  const outputFileNames = await processSubs(subscriptionsStream, deliveryDate, stage, holidaySuspensions)
  return outputFileNames.map(f => f.filename).join()
}
