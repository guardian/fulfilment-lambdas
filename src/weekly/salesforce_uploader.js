// @flow

import { fetchConfig } from '../lib/config'
import { uploadFiles } from '../lib/S3ToSalesforceUploader'
import { authenticate } from '../lib/salesforceAuthenticator'
import type { uploadDownload } from '../lib/config'
import type { UploadInfo } from '../lib/S3ToSalesforceUploader'
import moment from 'moment'

type weeklyUploaderInput = {
  deliveryDate: string
}

function getDeliveryDate (input: weeklyUploaderInput) {
  if (!input.deliveryDate) {
    throw new Error('deliveryDate must be in the format "YYYY-MM-DD"')
  }
  let deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD')
  if (!deliveryDate.isValid()) {
    throw new Error('deliveryDate must be in the format "YYYY-MM-DD"')
  }
  return deliveryDate
}

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

async function asyncHandler (input: weeklyUploaderInput) {
  let config = await fetchConfig()
  console.log('Config fetched successfully.')
  let salesforce = await authenticate(config)
  let deliveryDate = getDeliveryDate(input)
  console.log(`delivery date is ${input.deliveryDate}`)

  let sfFormattedDeliveryDate = deliveryDate.format('DD_MM_YYYY')
  let uploadTimeStamp = moment().format('DDMMYYYY_HH')

  function sfWeeklyFileName (prefix: string) {
    return `${prefix}_${sfFormattedDeliveryDate}_${uploadTimeStamp}.csv`
  }

  let sourceFileName = `${deliveryDate.format('YYYY-MM-DD')}_WEEKLY.csv`

  let filesToUpload = [
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

export function handler (input: weeklyUploaderInput, context: any, callback: (error: any, response: any) => void) {
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
