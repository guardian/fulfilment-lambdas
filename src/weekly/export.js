// @flow
import csv from 'fast-csv'
import moment from 'moment'
import { upload, createReadStream } from './../lib/storage'
import { ReadStream } from 'fs'
import {getStage, fetchConfig} from './../lib/config'
import {generateFilename} from './../lib/Filename'
import type {Filename} from './../lib/Filename'
import {WeeklyExporter, CaExporter, USExporter, AusExporter} from './WeeklyExporter'
import type {result, input} from '../exporter'

const SUBSCRIPTION_NAME = 'Subscription.Name'
const HOLIDAYS_QUERY_NAME = 'WeeklyHolidaySuspensions'
const SUBSCRIPTIONS_QUERY_NAME = 'WeeklySubscriptions'

function getDownloadStream (results: Array<result>, stage: string, queryName: string): Promise<ReadStream> {
  function getFileName (queryName) {
    function isTargetQuery (result) {
      return result.queryName === queryName
    }

    let filtered = results.filter(isTargetQuery)
    console.log(results, '!')

    if (filtered.length !== 1) {
      return null // not sure if there are options in js
    } else {
      return filtered[0].fileName
    }
  }

  return new Promise((resolve, reject) => {
    console.log(`getting results file for query: ${queryName}`)
    let fileName = getFileName(queryName)
    if (!fileName) {
      reject(new Error(`Invalid input cannot find unique query called ${queryName}`))
      return
    }
    let path = `${stage}/zuoraExport/${fileName}`
    resolve(createReadStream(path))
  })
}

function getHolidaySuspensions (downloadStream: ReadStream): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    let suspendedSubs = new Set()

    let csvStream = csv.parse({
      headers: true
    })
      .on('data', function (data) {
        let subName = data['Subscription.Name']
        suspendedSubs.add(subName)
      })
      .on('end', function () {
        resolve(suspendedSubs)
      })

    downloadStream.on('error', function (err) {
      reject(new Error(`error reading holidaySuspensions: ${err}`))
    })
      .pipe(csvStream)
  })
}

async function processSubs (downloadStream: ReadStream, deliveryDate: moment, stage: string, holidaySuspensions: Set<string>): Promise<Array<Filename>> {
  let config = await fetchConfig()
  console.log('loaded ' + holidaySuspensions.size + ' holiday suspensions')
  let exporters = [
    new WeeklyExporter('United Kingdom', deliveryDate, config.fulfilments.weekly.UK.uploadFolder),
    new CaExporter('Canada', deliveryDate, config.fulfilments.weekly.CA.uploadFolder),
    new USExporter('USA', deliveryDate, config.fulfilments.weekly.USA.uploadFolder),
    new AusExporter('Australia', deliveryDate, config.fulfilments.weekly.AU.uploadFolder)

  ]

  let csvStream = csv.parse({
    headers: true
  })
      .on('data-invalid', function (data) {
        // TODO CAN WE LOG PII?
        console.log('ignoring invalid data: ' + data)
      })
      .on('data', function (data) {
        let subscriptionName = data[SUBSCRIPTION_NAME]
        if (!holidaySuspensions.has(subscriptionName)) {
          exporters.map(exporter => {
            if (exporter.useForRow(data)) {
              exporter.processRow(data)
            }
          })
        }
      }
  )
      .on('end', function () {
        exporters.map(exporter => {
          exporter.end()
        })
      })

  downloadStream.on('error', function (err) {
    throw new Error(`error reading holidaySuspensions: ${err}`)
  }).pipe(csvStream)
  let uploads = exporters.map(async (exporter) => {
    let outputFileName = generateFilename(deliveryDate, 'WEEKLY')

    await upload(exporter.writeCSVStream, outputFileName, exporter.folder)
    return outputFileName
  })
  return Promise.all(uploads)
}

function getDeliveryDate (input: input): Promise<moment> {
  return new Promise((resolve, reject) => {
    let deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD')
    if (deliveryDate.isValid()) {
      resolve(deliveryDate)
    } else {
      reject(new Error('invalid deliverydate expected format YYYY-MM-DD'))
    }
  })
}

export async function weeklyExport (input: input) {
  let stage = await getStage()
  let deliveryDate = await getDeliveryDate(input)
  let holidaySuspensionsStream = await getDownloadStream(input.results, stage, HOLIDAYS_QUERY_NAME)
  let holidaySuspensions = await getHolidaySuspensions(holidaySuspensionsStream)
  let subscriptionsStream = await getDownloadStream(input.results, stage, SUBSCRIPTIONS_QUERY_NAME)
  let outputFileNames = await processSubs(subscriptionsStream, deliveryDate, stage, holidaySuspensions)
  return outputFileNames.map(f => f.filename).join()
}
