// @flow
import type { Salesforce, Folder } from './salesforceAuthenticator'
import type { S3Folder } from './storage'
import { getObject } from './storage'
import util from 'util'

export type sfDestination = {
  sfDescription: string,
  sfFolder: Folder,
  fileName: string
}

export type FileUpload = {
  destination: sfDestination,
  fileData: any
}
export type UploadInfo = {
  source: S3Folder,
  destination: sfDestination
}

export async function uploadFiles (filesToUpload: UploadInfo[], salesforce: Salesforce) {
  const filesFromS3 = filesToUpload.map(async fileToUpload => {
    const fileData = await getFromS3(fileToUpload.source)
    return {
      destination: fileToUpload.destination,
      fileData: fileData
    }
  })
  const s3files = await Promise.all(filesFromS3)
  const uploadResults = s3files.map(s3File => uploadToSalesforce(s3File, salesforce))
  return Promise.all(uploadResults)
}

async function uploadToSalesforce (fUp: FileUpload, salesforce: Salesforce) {
  const folderName = fUp.destination.sfFolder.name
  const sfFileName = fUp.destination.fileName
  console.log(`Uploading to Salesforce ${folderName}/${sfFileName}`)
  const uploadResult = await salesforce.uploadDocument(sfFileName, fUp.destination.sfFolder, fUp.destination.sfDescription, fUp.fileData.file.Body)
  return { name: sfFileName, id: uploadResult.id }
}

async function getFromS3 (source: S3Folder) {
  try {
    const s3Path = source.prefix
    const file = await getObject(s3Path)
    return { s3Path: s3Path, file: file }
  } catch (err) {
    throw new Error(`Failed to download ${source.prefix} from S3 ${util.inspect(err)}`)
  }
}
