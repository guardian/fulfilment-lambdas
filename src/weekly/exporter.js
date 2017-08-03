// @flow
import csv from 'fast-csv'
import moment from 'moment'
import { upload, createReadStream } from './../lib/storage'
import { ReadStream } from 'fs'
import {getStage} from './../lib/config'
import {weeklyOutputFileName as generateOutputFileName} from './../lib/filenames'
import WeeklyExporter from './WeeklyExporter'

const SUBSCRIPTION_NAME = 'Subscription.Name'
const HOLIDAYS_QUERY_NAME = 'WeeklyHolidaySuspensions'
const SUBSCRIPTIONS_QUERY_NAME = 'WeeklySubscriptions'

type result = {
  queryName: string,
  fileName: string
}
type ExporterInput = {
  deliveryDate: string,
  results: Array<result>
}

function getDownloadStream (results: Array<result>, stage: string, queryName: string): Promise<ReadStream> {
  function getFileName (queryName) {
    function isTargetQuery (result) {
      return result.queryName === queryName
    }

    let filtered = results.filter(isTargetQuery)

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
function processSubs (downloadStream: ReadStream, deliveryDate: moment, stage: string, holidaySuspensions: Set<string>): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('loaded ' + holidaySuspensions.size + ' holiday suspensions')
    let exporters = [new WeeklyExporter('United Kingdom', deliveryDate), new WeeklyExporter('Canada', deliveryDate)]

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
      reject(new Error(`error reading holidaySuspensions: ${err}`))
    })
      .pipe(csvStream)
    exporters.map(exporter => {
      let outputFileName = generateOutputFileName(deliveryDate, exporter.country)
      let outputLocation = `${stage}/weekly_fulfilment_output/${outputFileName}`

      upload(exporter.writeCSVStream, outputLocation, function (err, data) {
        if (err) {
          console.log('ERROR ' + err)
          reject(err)
        } else {
          resolve(outputFileName)
        }
      })
    })
  })
}

function getDeliveryDate (input: ExporterInput): Promise<moment> {
  return new Promise((resolve, reject) => {
    let deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD')
    if (deliveryDate.isValid()) {
      resolve(deliveryDate)
    } else {
      reject(new Error('invalid deliverydate expected format YYYY-MM-DD'))
    }
  })
}

async function asyncHandler (input: ExporterInput) {
  let stage = await getStage()
  let deliveryDate = await getDeliveryDate(input)
  let holidaySuspensionsStream = await getDownloadStream(input.results, stage, HOLIDAYS_QUERY_NAME)
  let holidaySuspensions = await getHolidaySuspensions(holidaySuspensionsStream)
  let subscriptionsStream = await getDownloadStream(input.results, stage, SUBSCRIPTIONS_QUERY_NAME)
  let outputFileName = await processSubs(subscriptionsStream, deliveryDate, stage, holidaySuspensions)
  return outputFileName
}

export function handler (input: ExporterInput, context: ?any, callback: Function) {
  asyncHandler(input)
    .then(outputFileName => callback(null, {...input, fulfilmentFile: outputFileName}))
    .catch(e => {
      console.log(e)
      callback(e)
    })
}
