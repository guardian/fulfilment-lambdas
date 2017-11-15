// @flow
import type { Salesforce, folder } from './salesforceAuthenticator'
import type { S3Folder } from './storage'
import { getObject } from './storage'

export type sfDestination = {
  sfDescription: string,
  sfFolder: folder,
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
  let filePromises = filesToUpload.map(async fileToUpload => {
    let fileData = await getFileData(fileToUpload.source)
    return {
      destination: fileToUpload.destination,
      fileData: fileData
    }
  })

  let allFileResponse = await Promise.all(filePromises)
  let successFulFileResponses = allFileResponse.filter(f => f.fileData.file != null)
  let uploadResults = successFulFileResponses.map(f => { return uploadFile(f, salesforce) })
  return Promise.all(uploadResults)
}

async function uploadFile (fUp: FileUpload, salesforce: Salesforce) {
  let folderName = fUp.destination.sfFolder.name
  let sfFileName = fUp.destination.fileName
  console.log(`uploading ${sfFileName} to ${folderName}`)
  let uploadResult = await salesforce.uploadDocument(sfFileName, fUp.destination.sfFolder, fUp.destination.sfDescription, fUp.fileData.file.Body)
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
    console.log(`could not download ${source.prefix}, error from S3:`)
    console.log(err)
    return Promise.resolve({
      s3Path: s3Path,
      file: null
    })
  }
}
