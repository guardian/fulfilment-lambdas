// @flow
import AWS from 'aws-sdk'
import {Readable} from 'stream'
import {NamedError} from './NamedError'
let s3 = new AWS.S3({signatureVersion: 'v4'})
const BUCKET = 'fulfilment-output-test'
export type S3UploadResponse = {
  Location: string,
  ETag: string,
  Bucket: string,
  Key: string
}

export type S3Folder = {
  bucket: string,
  prefix: string
}

export async function ls (folder: S3Folder) {
  let resp = await s3.listObjectsV2({
    Bucket: folder.bucket,
    Prefix: folder.prefix
  }).promise()
  return resp.Contents
}

export async function upload (source: Buffer | string | Readable, outputLocation: string, folder: ?S3Folder): Promise<S3UploadResponse> {
  let key = folder ? `${folder.prefix}${outputLocation}` : outputLocation
  console.log(`uploading to ${BUCKET}/${key}`)

  let params = {
    Bucket: BUCKET,
    Key: key,
    Body: source,
    ServerSideEncryption: 'aws:kms'
  }
  let upload = s3.upload(params)
  if (upload == null) {
    throw new NamedError('S3 error', 's3.upload returned null, this should never happen')
  }
  let result = await upload.promise()
  if (result.Location == null || result.ETag == null || result.Bucket == null || result.key == null) {
    throw new NamedError('S3 error', 's3.upload.promise has missing fields, this should never happen')
  }
  return result
}

export function createReadStream (path: string) {
  console.log(`reading file from ${BUCKET}/${path}`)
  let options = {Bucket: BUCKET, Key: path}

  return s3.getObject(options).createReadStream()
}

export function getObject (path: string) {
  let options = {Bucket: BUCKET, Key: path}
  console.log(`Retrieving file ${options.Key} from S3 bucket ${options.Bucket}.`)
  return s3.getObject(options).promise()
}

export function copyObject (sourcePath: string, destPath: string) {
  let options = {
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourcePath}`,
    Key: destPath
  }
  console.log(`copying file ${BUCKET}/${sourcePath} to ${BUCKET}/${destPath}`)
  return s3.copyObject(options).promise()
}

export function getFileInfo (path: string) {
  let options = {Bucket: BUCKET, Key: path}
  console.log(`Retrieving information for file ${options.Key} from S3 bucket ${options.Bucket}.`)
  return s3.headObject(options).promise()
}
