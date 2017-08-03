import moment from 'moment'

const SALESFORCE_DATE_FORMAT = 'DD_MM_YYYY'
export const OUTPUT_DATE_FORMAT = 'YYYY-MM-DD'
const DAY_OF_WEEK = 'dddd'
// const OLD_OUTPUT_REGEX = /HOME_DELIVERY_[^_]*_(\d\d_\d\d_\d\d\d\d).csv/
const OUTPUT_REGEX = /(\d\d\d\d-\d\d-\d\d)_HOME_DELIVERY.csv/
const LOG_REGEX = /(\d\d\d\d-\d\d-\d\d)_HOME_DELIVERY.log/
const SLOPPY_REGEX = /\w*(\d\d_\d\d_\d\d\d\d).csv/

function extractDate (string: string, r: RegExp, formatString: ?string):?moment {
  let dateMatch = string.match(r)
  if (dateMatch == null || dateMatch.length !== 2) {
    console.log('Could not find date in filename', string, 'with regex', r)
    return null
  }
  let dateString = dateMatch[1].replace(/_/g, '-')
  if (!moment(dateString, formatString).isValid()) {
    console.log('invalid', dateString)
  }
  return moment(dateString, formatString)
}

export function weeklyOutputFileName (deliveryDate: moment, country: string):string {
  let dateSuffix = deliveryDate.format(OUTPUT_DATE_FORMAT)
  return `${dateSuffix}_WEEKLY_${country}.csv`
}

export function outputFileName (deliveryDate: moment):string {
  let dateSuffix = deliveryDate.format(OUTPUT_DATE_FORMAT)
  return `${dateSuffix}_HOME_DELIVERY.csv`
}

export function logFileName (deliveryDate: moment):string {
  let dateSuffix = deliveryDate.format(OUTPUT_DATE_FORMAT)
  return `${dateSuffix}_HOME_DELIVERY.log`
}

export function salesforceFileName (deliveryDate: moment):string {
  let chargeDay = deliveryDate.format(DAY_OF_WEEK)
  let dateSuffix = deliveryDate.format(SALESFORCE_DATE_FORMAT)
  return `HOME_DELIVERY_${chargeDay}${dateSuffix}.csv`
}
export function outputDate (filename:string):?moment {
  return extractDate(filename, OUTPUT_REGEX)
}
export function logDate (filename:string):?moment {
  return extractDate(filename, LOG_REGEX)
}

export function salesforceDate (filename:string):?moment {
  return extractDate(filename, SLOPPY_REGEX, 'DD-MM-YYYY')
}
