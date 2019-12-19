// @flow
import moment from 'moment'
import { fetchConfig } from './lib/config'
import { getFileInfo } from './lib/storage'

export function handler (input: ?any, context: ?any, callback: Function) {
  checkFile()
    .then(checkPassed => {
      logCheckResult(checkPassed)
      const resultString = checkPassed ? 'passed' : 'failed'
      callback(null, { result: resultString })
    })
    .catch(e => {
      console.log(e)
      logCheckResult(false)
      callback(null, { result: 'failed' })
    })
}

const maxAgeFor = {
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
  const config = await fetchConfig()
  const today = moment()
  const tomorrow = moment().add(1, 'day')
  const filePath = `${config.fulfilments.homedelivery.uploadFolder.prefix}${tomorrow.format('YYYY-MM-DD')}_HOME_DELIVERY.csv`
  const metadata = await getFileInfo(filePath)
  const lastModified = moment(metadata.LastModified)
  console.log(`Last modified date ${lastModified.format('YYYY-MM-DD')}`)
  const fileAge = today.diff(lastModified, 'days')
  console.log(`File is ${fileAge} day(s) old`)
  const tomorrowDayOfTheWeek = tomorrow.format('ddd')
  const maxAllowedAge = maxAgeFor[tomorrowDayOfTheWeek]
  console.log(`Max allowed age for ${tomorrowDayOfTheWeek} files is ${maxAllowedAge}`)
  return fileAge <= maxAllowedAge
}
