// @flow
import csv from 'fast-csv'
import moment from 'moment'
import { formatPostCode } from './lib/formatters'
import { upload, createReadStream } from './lib/storage'
import { ReadStream } from 'fs'
import {getStage} from './lib/config'

// input headers
const ADDRESS_1 = 'SoldToContact.Address1'
const ADDRESS_2 = 'SoldToContact.Address2'
const CITY = 'SoldToContact.City'
const FIRST_NAME = 'SoldToContact.FirstName'
const LAST_NAME = 'SoldToContact.LastName'
const POSTAL_CODE = 'SoldToContact.PostalCode'
const SUBSCRIPTION_NAME = 'Subscription.Name'
const QUANTITY = 'RatePlanCharge.Quantity'
const WORK_PHONE = 'SoldToContact.WorkPhone'
const DELIVERY_INSTRUCTIONS = 'Account.SpecialDeliveryInstructions__c'
// output headers
const CUSTOMER_REFERENCE = 'Customer Reference'
const CUSTOMER_FULL_NAME = 'Customer Full Name'
const CUSTOMER_ADDRESS_LINE_1 = 'Customer Address Line 1'
const CUSTOMER_ADDRESS_LINE_2 = 'Customer Address Line 2'
const CUSTOMER_POSTCODE = 'Customer PostCode'
const CUSTOMER_TOWN = 'Customer Town'
const ADDITIONAL_INFORMATION = 'Additional Information'
const DELIVERY_QUANTITY = 'Delivery Quantity'
const SENT_DATE = 'Sent Date'
const DELIVERY_DATE = 'Delivery Date'
const CHARGE_DAY = 'Charge day'
const CUSTOMER_PHONE = 'Customer Telephone'
const outputHeaders = [CUSTOMER_REFERENCE, 'Contract ID', CUSTOMER_FULL_NAME, 'Customer Job Title', 'Customer Company', 'Customer Department', CUSTOMER_ADDRESS_LINE_1, CUSTOMER_ADDRESS_LINE_2, 'Customer Address Line 3', CUSTOMER_TOWN, CUSTOMER_POSTCODE, DELIVERY_QUANTITY, CUSTOMER_PHONE, 'Property type', 'Front Door Access', 'Door Colour', 'House Details', 'Where to Leave', 'Landmarks', ADDITIONAL_INFORMATION, 'Letterbox', 'Source campaign', SENT_DATE, DELIVERY_DATE, 'Returned Date', 'Delivery problem', 'Delivery problem notes', CHARGE_DAY]
const HOLIDAYS_QUERY_NAME = 'HolidaySuspensions'
const SUBSCRIPTIONS_QUERY_NAME = 'Subscriptions'

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
  let sentDate = moment().format('DD/MM/YYYY')
  let chargeDay = deliveryDate.format('dddd')
  let formattedDeliveryDate = deliveryDate.format('DD/MM/YYYY')

  return new Promise((resolve, reject) => {
    console.log('loaded ' + holidaySuspensions.size + ' holiday suspensions')
    let writeCSVStream = csv.createWriteStream({
      headers: outputHeaders
    })

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
          let outputCsvRow = {}
          outputCsvRow[CUSTOMER_REFERENCE] = subscriptionName
          outputCsvRow[CUSTOMER_TOWN] = data[CITY]
          outputCsvRow[CUSTOMER_POSTCODE] = formatPostCode(data[POSTAL_CODE])
          outputCsvRow[CUSTOMER_ADDRESS_LINE_1] = data[ADDRESS_1]
          outputCsvRow[CUSTOMER_ADDRESS_LINE_2] = data[ADDRESS_2]
          outputCsvRow[CUSTOMER_FULL_NAME] = data[FIRST_NAME] + ' ' + data[LAST_NAME]
          outputCsvRow[DELIVERY_QUANTITY] = data[QUANTITY]
          outputCsvRow[SENT_DATE] = sentDate
          outputCsvRow[DELIVERY_DATE] = formattedDeliveryDate
          outputCsvRow[CHARGE_DAY] = chargeDay
          outputCsvRow[CUSTOMER_PHONE] = data[WORK_PHONE]
          outputCsvRow[ADDITIONAL_INFORMATION] = data[DELIVERY_INSTRUCTIONS]
          writeCSVStream.write(outputCsvRow)
        }
      })
      .on('end', function () {
        writeCSVStream.end()
      })

    downloadStream.on('error', function (err) {
      reject(new Error(`error reading holidaySuspensions: ${err}`))
    })
      .pipe(csvStream)

    let dateSuffix = deliveryDate.format('DD_MM_YYYY')
    let outputFileName = `HOME_DELIVERY_${chargeDay}_${dateSuffix}.csv`
    let outputLocation = `${stage}/fulfilment_output/${outputFileName}`

    upload(writeCSVStream, outputLocation, function (err, data) {
      if (err) {
        console.log('ERROR ' + err)
        reject(err)
      } else {
        resolve(outputFileName)
      }
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
    .then(outputFileName => callback(null, {fulfilmentFile: outputFileName}))
    .catch(e => {
      console.log(e)
      callback(e)
    })
}
