// @flow
import * as csv from 'fast-csv'
import moment from 'moment'
import { formatPostCode } from './../lib/formatters'
import { upload, createReadStream } from './../lib/storage'
import { ReadStream } from 'fs'
import { getStage, fetchConfig } from './../lib/config'
import { generateFilename } from './../lib/Filename'
import type { result, Input } from '../exporter'

// input headers
const ADDRESS_1 = 'SoldToContact.Address1'
const ADDRESS_2 = 'SoldToContact.Address2'
const CITY = 'SoldToContact.City'
// const TITLE = 'SoldToContact.Title__c'
const FIRST_NAME = 'SoldToContact.FirstName'
const LAST_NAME = 'SoldToContact.LastName'
const POSTAL_CODE = 'SoldToContact.PostalCode'
const SUBSCRIPTION_NAME = 'Subscription.Name'
const QUANTITY = 'RatePlanCharge.Quantity'
const WORK_PHONE = 'SoldToContact.WorkPhone'
const DELIVERY_INSTRUCTIONS = 'SoldToContact.SpecialDeliveryInstructions__c'
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

function getHolidaySuspensions (downloadStream: ReadStream): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const suspendedSubs = new Set()
    downloadStream
      .pipe(csv.parse({ headers: true }))
      .on('error', error => reject(Error(`Failed to read HolidaySuspensions raw CSV: ${error}`)))
      .on('data', row => {
        const subName = row['Subscription.Name']
        suspendedSubs.add(subName)
      })
      .on('end', rowCount => {
        console.log(`Successfully read ${rowCount} rows of HolidaySuspensions`)
        resolve(suspendedSubs)
      })
  })
}

function getFullName (zFirstName: string, zLastName: string) {
  let firstName = zFirstName
  if (firstName.trim() === '.') {
    firstName = ''
  }
  return [firstName, zLastName].join(' ').trim()
}

/**
 *  Transforms raw CSV from Zuora to expected CSV format, and uploads it to S3 under fulfilment_outputs folder.
 *  FIXME: Rename fulfilment_outputs to something meaningful such as home_delivery!
 *
 * @param downloadStream raw Home Delivery CSV exported from Zuora
 * @param deliveryDate
 * @param stage
 * @param holidaySuspensions subscriptions to filter out from CSV
 * @returns {Promise<string>} the filename of result CSV in new format
 */
async function processSubs (downloadStream: ReadStream, deliveryDate: moment, stage: string, holidaySuspensions: Set<string>): Promise<string> {
  const sentDate = moment().format('DD/MM/YYYY')
  const chargeDay = deliveryDate.format('dddd')
  const formattedDeliveryDate = deliveryDate.format('DD/MM/YYYY')
  const config = await fetchConfig()
  const folder = config.fulfilments.homedelivery.uploadFolder

  console.log('loaded ' + holidaySuspensions.size + ' holiday suspensions')
  const csvFormatterStream = csv.format({ headers: outputHeaders, quoteColumns: true })

  const writeRowToCsvStream = (row, csvStream) => {
    const subscriptionName = row[SUBSCRIPTION_NAME]
    if (!holidaySuspensions.has(subscriptionName)) {
      const outputCsvRow = {}
      outputCsvRow[CUSTOMER_REFERENCE] = subscriptionName
      outputCsvRow[CUSTOMER_TOWN] = row[CITY]
      outputCsvRow[CUSTOMER_POSTCODE] = formatPostCode(row[POSTAL_CODE])
      outputCsvRow[CUSTOMER_ADDRESS_LINE_1] = row[ADDRESS_1]
      outputCsvRow[CUSTOMER_ADDRESS_LINE_2] = row[ADDRESS_2]
      outputCsvRow[CUSTOMER_FULL_NAME] = getFullName(row[FIRST_NAME], row[LAST_NAME])
      outputCsvRow[DELIVERY_QUANTITY] = row[QUANTITY]
      outputCsvRow[SENT_DATE] = sentDate
      outputCsvRow[DELIVERY_DATE] = formattedDeliveryDate
      outputCsvRow[CHARGE_DAY] = chargeDay
      outputCsvRow[CUSTOMER_PHONE] = row[WORK_PHONE]
      outputCsvRow[ADDITIONAL_INFORMATION] = row[DELIVERY_INSTRUCTIONS]
      csvStream.write(outputCsvRow)
    }
  }

  const writableCsvPromise =
    new Promise((resolve, reject) => {
      downloadStream
        .pipe(csv.parse({ headers: true }))
        .on('error', error => {
          console.log('Failed to write HomeDelivery CSV: ', error)
          reject(Error(error))
        })
        .on('data', row => writeRowToCsvStream(row, csvFormatterStream))
        .on('end', rowCount => {
          console.log(`Successfully written ${rowCount} rows`)
          csvFormatterStream.end()
          resolve()
        })
    })

  const outputFileName = generateFilename(deliveryDate, 'HOME_DELIVERY')
  await writableCsvPromise
  await upload(csvFormatterStream, outputFileName, folder)
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

export async function homedeliveryExport (input: Input) {
  const stage = await getStage()
  const deliveryDate = await getDeliveryDate(input)
  const holidaySuspensionsStream = await getDownloadStream(input.results, stage, HOLIDAYS_QUERY_NAME)
  const holidaySuspensions = await getHolidaySuspensions(holidaySuspensionsStream)
  const subscriptionsStream = await getDownloadStream(input.results, stage, SUBSCRIPTIONS_QUERY_NAME)
  const outputFileName = await processSubs(subscriptionsStream, deliveryDate, stage, holidaySuspensions)
  return outputFileName
}
