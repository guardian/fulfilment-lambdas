// @flow

import { fetchConfig } from '../lib/config'
import { uploadFiles } from '../lib/S3ToSalesforceUploader'
import { authenticate } from '../lib/salesforceAuthenticator'
import type { uploadDownload } from '../lib/config'
import type { UploadInfo } from '../lib/S3ToSalesforceUploader'
import moment from 'moment'
import { getDeliveryDate } from './WeeklyInput'
import type { WeeklyInput } from './WeeklyInput'

function getUploadInfo (upDown: uploadDownload, destFileName: string, sourceFileName: string): UploadInfo {
  return {
    source: {
      bucket: upDown.uploadFolder.bucket,
      prefix: upDown.uploadFolder.prefix + sourceFileName
    },
    destination: {
      fileName: destFileName,
      sfDescription: `Weekly fulfilment file ${destFileName}`,
      sfFolder: {
        folderId: upDown.uploadFolder.folderId,
        name: upDown.uploadFolder.name
      }
    }
  }
}

async function asyncHandler (input: WeeklyInput) {
  const config = await fetchConfig()
  console.log('Config fetched successfully.')
  const salesforce = await authenticate(config)
  const deliveryDate = getDeliveryDate(input)
  console.log(`delivery date is ${deliveryDate.format('DD_MM_YYYY')}`)

  const sfFormattedDeliveryDate = deliveryDate.format('DD_MM_YYYY')
  const uploadTimeStamp = moment().format('DDMMYYYY_HH')

  function sfWeeklyFileName (prefix: string) {
    return `${prefix}_${sfFormattedDeliveryDate}_${uploadTimeStamp}.csv`
  }

  const sourceFileName = `${deliveryDate.format('YYYY-MM-DD')}_WEEKLY.csv`

  const filesToUpload = [
    getUploadInfo(config.fulfilments.weekly.NZ, sfWeeklyFileName('GWNZ'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.FR, sfWeeklyFileName('GWFR'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.AU, sfWeeklyFileName('GWAU'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.CA, sfWeeklyFileName('GWCA'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.CAHAND, sfWeeklyFileName('GWCA_HAND'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.HK, sfWeeklyFileName('GWHK'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.ROW, sfWeeklyFileName('GWRW'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.UK, sfWeeklyFileName('GWUK'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.US, sfWeeklyFileName('GWUS'), sourceFileName),
    getUploadInfo(config.fulfilments.weekly.VU, sfWeeklyFileName('GWVA'), sourceFileName)
  ]

  return uploadFiles(filesToUpload, salesforce)
}

export function handler (input: WeeklyInput, context: any, callback: (error: any, response: any) => void) {
  asyncHandler(input)
    .then(uploadedFiles => {
      console.log('returning success ')
      callback(null, uploadedFiles)
    })
    .catch(error => {
      console.log(error)
      callback(null, error)
    })
}
