// @flow
import type { Config, uploadDownload, fulfilmentType } from './config'
import type { Salesforce, folder } from './salesforceAuthenticator'
import { authenticate } from './salesforceAuthenticator'

import type { S3Folder } from './storage'
import { getObject } from './storage'
import moment from 'moment'

type sfDestination = {
  sfDescriptionPrefix: string,
  sfFolder: folder,
  fileName: string
}

type FileUpload = {
  destination: sfDestination,
  fileData: any // not sure what this is supposed to be mayeb check aws
}
type UploadInfo = {
  source: S3Folder,
  destination: sfDestination
}

export async function uploadFiles (config: Config, deliveryDate: moment) {
  const salesforce = await authenticate(config)
  let filesToUpload = getFolders(config, 'weekly', deliveryDate)
  let filePromises = filesToUpload.map(async fileToUpload => {
    let fileData = await getFileData(fileToUpload.source)
    return {
      destination: fileToUpload.destination,
      fileData: fileData
    }
  })
  let files = await Promise.all(filePromises)
  let uploadResults = files.map(f => { return uploadFile(f, salesforce) })
  return Promise.all(uploadResults)
}

async function uploadFile (fUp: FileUpload, salesforce: Salesforce) {
  let folderName = fUp.destination.sfFolder.name
  let sfFileName = fUp.destination.fileName
  console.log(`uploading ${sfFileName} to ${folderName}`)
  let sfFileDescription = `${fUp.destination.sfDescriptionPrefix} ${sfFileName}`
  let uploadResult = await salesforce.uploadDocument(sfFileName, fUp.destination.sfFolder, sfFileDescription, fUp.fileData.file.Body)
  return Promise.resolve({
    name: sfFileName,
    id: uploadResult.id
  })
}

async function getFileData (source: S3Folder) {
  let s3Path = source.prefix
  try {
    let file = await getObject(s3Path)
    return Promise.resolve({
      s3Path: s3Path,
      file: file
    })
  } catch (err) {
    console.log('error from  S3:')
    console.log(err)
    throw err
  }
}

// todo see if we have to change the names of the config to sf and s3 folders as they are both sometimes used for upload or download
function getUploadInfo (fulfilmentType: fulfilmentType, upDown: uploadDownload, destFileName: string, sourceFileName: string): UploadInfo {
  return {
    source: {
      bucket: upDown.uploadFolder.bucket,
      prefix: upDown.uploadFolder.prefix + sourceFileName
    },
    destination: {
      fileName: destFileName,
      sfDescriptionPrefix: `${fulfilmentType} fulfilment file `,
      sfFolder: {
        folderId: upDown.downloadFolder.folderId,
        name: upDown.downloadFolder.name
      }
    }
  }
}

function getFolders (config: Config, type: fulfilmentType, deliveryDate: moment): UploadInfo[] {
  let sfFormattedDeliveryDate = deliveryDate.format('DD_MM_YYYY')
  // maybe we could get creation date from the actual files but it probably doesn't matter
  let uploadTimeStamp = moment().format('DDMMYYYY_HH')

  if (type === 'homedelivery') {
    let sourceFileName = `${deliveryDate.format('YYYY-MM-DD')}.csv`
    let deliveryDayOfTheWeek = deliveryDate.format('dddd')
    let destinationFileName = `HOME_DELIVERY_${deliveryDayOfTheWeek}_${sfFormattedDeliveryDate}.csv`
    return [getUploadInfo(type, config.fulfilments.homedelivery, destinationFileName, sourceFileName)]
  }
  function sfWeeklyFileName (prefix: string) {
    return `${prefix}_${sfFormattedDeliveryDate}_${uploadTimeStamp}.csv`
  }

  if (type === 'weekly') {
    let sourceFileName = `${deliveryDate.format('YYYY-MM-DD')}_WEEKLY.csv`
    return [
      getUploadInfo(type, config.fulfilments.weekly.NZ, sfWeeklyFileName('GWNZ'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.FR, sfWeeklyFileName('GWFR'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.AU, sfWeeklyFileName('GWAU'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.CA, sfWeeklyFileName('GWCA'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.CAHAND, sfWeeklyFileName('GWCA_HAND'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.HK, sfWeeklyFileName('GWHK'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.ROW, sfWeeklyFileName('GWRW'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.UK, sfWeeklyFileName('GWUK'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.US, sfWeeklyFileName('GWUS'), sourceFileName),
      getUploadInfo(type, config.fulfilments.weekly.VU, sfWeeklyFileName('GWVA'), sourceFileName)
    ]
  }
  return []
}
