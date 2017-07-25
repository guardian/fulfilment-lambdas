import moment from 'moment'
import { getStage } from './lib/config'
import { getFileInfo } from './lib/storage'

export function handler (input, context, callback) {
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

let maxAgeDays = {
  Mon: 3,
  Tue: 1,
  Wed: 1,
  Thu: 1,
  Fri: 1,
  Sat: 1,
  Sun: 2
}

function logCheckResult (checkPassed) {
  if (checkPassed) {
    console.log('CHECK:PASSED')
  } else {
    console.log('CHECK:FAILED')
  }
}

async function checkFile () {
  let stage = await getStage()
  let currentDate = moment()
  let formattedCurrentDate = currentDate.format('YYYY-MM-DD')
  let filePath = `${stage}/fulfilment_output/${formattedCurrentDate}_HOME_DELIVERY.csv`
  let metadata = await getFileInfo(filePath)
  let lastModified = moment(metadata.LastModified)
  console.log(`Last mofification date ${lastModified.format('YYYY-MM-DD')}`)
  let fileAge = currentDate.diff(lastModified, 'days')
  console.log(`File is ${fileAge} day(s) old`)
  let currentDayOfWeek = currentDate.format('ddd')
  let maxAllowedAge = maxAgeDays[currentDayOfWeek]
  console.log(`Max allowed age for ${currentDayOfWeek} files is ${maxAllowedAge}`)
  return fileAge <= maxAllowedAge
}
