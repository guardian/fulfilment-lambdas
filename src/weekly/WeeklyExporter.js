
// @flow
import { formatPostCode } from './../lib/formatters'
import csv from 'fast-csv'
import moment from 'moment'
import type { S3Folder } from './../lib/storage'

// input headers
const ADDRESS_1 = 'SoldToContact.Address1'
const ADDRESS_2 = 'SoldToContact.Address2'
const CITY = 'SoldToContact.City'
const COUNTRY = 'SoldToContact.Country'
const TITLE = 'SoldToContact.Title__c'
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
const outputHeaders = [
  CUSTOMER_REFERENCE,
  'Contract ID',
  CUSTOMER_FULL_NAME,
  'Customer Job Title',
  'Customer Company',
  'Customer Department',
  CUSTOMER_ADDRESS_LINE_1,
  CUSTOMER_ADDRESS_LINE_2,
  'Customer Address Line 3',
  CUSTOMER_TOWN,
  CUSTOMER_POSTCODE,
  DELIVERY_QUANTITY,
  CUSTOMER_PHONE,
  'Property type',
  'Front Door Access',
  'Door Colour',
  'House Details',
  'Where to Leave',
  'Landmarks',
  ADDITIONAL_INFORMATION,
  'Letterbox',
  'Source campaign',
  SENT_DATE,
  DELIVERY_DATE,
  'Returned Date',
  'Delivery problem',
  'Delivery problem notes',
  CHARGE_DAY
]

export default class {
  country: string
  sentDate: string
  formattedDeliveryDate: string
  chargeDay: string
  writeCSVStream: any
  folder: S3Folder

  constructor (country: string, deliveryDate: moment, folder: S3Folder) {
    this.country = country
    this.writeCSVStream = csv.createWriteStream({
      headers: outputHeaders
    })

    this.sentDate = moment().format('DD/MM/YYYY')
    this.chargeDay = deliveryDate.format('dddd')
    this.formattedDeliveryDate = deliveryDate.format('DD/MM/YYYY')
    this.folder = folder
  }
  useForRow (row:{[string]:string}):boolean {
    return !!(row[COUNTRY] && row[COUNTRY] === this.country)
  }

  processRow (row:{[string]:string}) {
    let outputCsvRow = {}
    outputCsvRow[CUSTOMER_REFERENCE] = row[SUBSCRIPTION_NAME]
    outputCsvRow[CUSTOMER_TOWN] = row[CITY]
    outputCsvRow[CUSTOMER_POSTCODE] = formatPostCode(row[POSTAL_CODE])
    outputCsvRow[CUSTOMER_ADDRESS_LINE_1] = row[ADDRESS_1]
    outputCsvRow[CUSTOMER_ADDRESS_LINE_2] = row[ADDRESS_2]
    outputCsvRow[CUSTOMER_FULL_NAME] = [row[TITLE], row[FIRST_NAME], row[LAST_NAME]].join(' ').trim()
    outputCsvRow[DELIVERY_QUANTITY] = row[QUANTITY]
    outputCsvRow[SENT_DATE] = this.sentDate
    outputCsvRow[DELIVERY_DATE] = this.formattedDeliveryDate
    outputCsvRow[CHARGE_DAY] = this.chargeDay
    outputCsvRow[CUSTOMER_PHONE] = row[WORK_PHONE]
    outputCsvRow[ADDITIONAL_INFORMATION] = row[DELIVERY_INSTRUCTIONS]
    this.writeCSVStream.write(outputCsvRow)
  }

  end () {
    this.writeCSVStream.end()
  }
}
