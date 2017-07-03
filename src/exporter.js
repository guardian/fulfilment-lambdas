import AWS from 'aws-sdk'
import csv from 'fast-csv'
import moment from 'moment'
import {formatPostCode} from './lib/formatters'

let s3 = new AWS.S3({ signatureVersion: 'v4' })

// input headers
const ADDRESS_1 = 'SoldToContact.Address1'
const ADDRESS_2 = 'SoldToContact.Address2'
const CITY = 'SoldToContact.City'
// const COUNTRY = 'SoldToContact.Country'  TODO NOT USED?
const FIRST_NAME = 'SoldToContact.FirstName'
const LAST_NAME = 'SoldToContact.LastName'
const POSTAL_CODE = 'SoldToContact.PostalCode'
// const STATE = 'SoldToContact.State' TODO NOT USED?
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
const BUCKET = 'fulfilment-output-test'
const HOLIDAYS_QUERY_NAME = 'HolidaySuspensions'
const SUBSCRIPTIONS_QUERY_NAME = 'Subscriptions'

const stage = process.env.Stage

export function handler (input, context, callback) {
  function getDownloadStreamFromBucket (queryName) {
    let fileName = getFileName(queryName)
    if (!fileName) {
      callback(new Error(`Invalid input cannot find unique query called ${queryName}`))
    }
    let key = `${stage}/zuoraExport/${fileName}`
    console.log(`reading ${queryName} file from ${BUCKET}/${key}`)
    let options = {Bucket: BUCKET, Key: key}
    return s3.getObject(options).createReadStream()
  }

  function getFileName (queryName) {
    function isTargetQuery (result) {
      return result.queryName === queryName
    }
    let filtered = input.results.filter(isTargetQuery)

    if (filtered.length !== 1) {
      return null // not sure if there are options in js
    } else {
      return filtered[0].fileName
    }
  }

  let sentDate = moment().format('DD/MM/YYYY')
  let chargeDay = moment(input.deliveryDate, 'YYYY-MM-DD').format('dddd')
  let deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD').format('DD/MM/YYYY')

  let getHolidaySuspensions = new Promise((resolve, reject) => {
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

    getDownloadStreamFromBucket(HOLIDAYS_QUERY_NAME)
            .on('error', function (err) {
              reject(new Error(`error reading holidaySuspensions: ${err}`))
            })
            .pipe(csvStream)
  })

  function processSubs (holidaySuspensions) {
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
                outputCsvRow[DELIVERY_DATE] = deliveryDate
                outputCsvRow[CHARGE_DAY] = chargeDay
                outputCsvRow[CUSTOMER_PHONE] = data[WORK_PHONE]
                outputCsvRow[ADDITIONAL_INFORMATION] = data[DELIVERY_INSTRUCTIONS]
                writeCSVStream.write(outputCsvRow)
              }
            })
            .on('end', function () {
              writeCSVStream.end()
            })

    getDownloadStreamFromBucket(SUBSCRIPTIONS_QUERY_NAME)
        .on('error', function (err) {
          callback(new Error(`error reading holidaySuspensions: ${err}`))
        })
        .pipe(csvStream)

    let dateSuffix = moment(input.deliveryDate, 'YYYY-MM-DD').format('DD_MM_YYYY')
    let outputFileName = `HOME_DELIVERY_${chargeDay}_${dateSuffix}.csv`
    let outputLocation = `${stage}/fulfilment_output/${outputFileName}`
    console.log(`saving fulfilment file to ${BUCKET}/${outputLocation}`)
    let params = {
      Bucket: BUCKET,
      Key: outputLocation,
      Body: writeCSVStream,
      ServerSideEncryption: 'aws:kms'
    }
    s3.upload(params).send(function (err, data) {
      if (err) {
        console.log('ERROR ' + err)
        callback(err)
      } else {
        callback(null, {
          fulfilmentFile: outputFileName
        })
      }
    })
  }

  console.log(`stage is ${stage}`)

  if (stage !== 'CODE' && stage !== 'PROD') {
    callback(new Error(`invalid stage: ${stage}, please fix Stage env variable`))
    return
  }
  getHolidaySuspensions.then(processSubs).catch(error => callback(error))
};
