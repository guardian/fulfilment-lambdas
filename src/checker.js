// @flow
import moment from 'moment'
import { getStage } from './lib/config'
import { getFileInfo } from './lib/storage'

export function handler (input: ?any, context: ?any, callback: Function) {
  checkFile()
    .then(checkPassed => {
      logCheckResult(checkPassed)
      callback(null, {result: 'passed'})
    })
    .catch(e => {
      console.log(e)
      logCheckResult(false)
      callback(null, {result: 'failed'})
    })
}

let maxAgeFor = {
  Mon: 2,
  Tue: 0,
  Wed: 0,
  Thu: 0,
  Fri: 0,
  Sat: 0,
  Sun: 1
}

function logCheckResult (checkPassed: boolean) {
  if (checkPassed) {
    console.log('CHECK:PASSED')
  } else {
    console.log('CHECK:FAILED')
  }
}

async function checkFile (): Promise<boolean> {
  let stage = await getStage()
  let today = moment()
  let tomorrow = moment().add(1, 'day')
  let filePath = `${stage}/fulfilment_output/${tomorrow.format('YYYY-MM-DD')}_HOME_DELIVERY.csv`
  let metadata = await getFileInfo(filePath)
  let lastModified = moment(metadata.LastModified)
  console.log(`Last modified date ${lastModified.format('YYYY-MM-DD')}`)
  let fileAge = today.diff(lastModified, 'days')
  console.log(`File is ${fileAge} day(s) old`)
  let tomorrowDayOfTheWeek = tomorrow.format('ddd')
  let maxAllowedAge = maxAgeFor[tomorrowDayOfTheWeek]
  console.log(`Max allowed age for ${tomorrowDayOfTheWeek} files is ${maxAllowedAge}`)
  return fileAge <= maxAllowedAge
}
