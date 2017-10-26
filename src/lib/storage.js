// @flow
import AWS from 'aws-sdk'
import {Readable} from 'stream'
import {getStage} from './config'
import NamedError from './NamedError'
import {Filename} from './Filename'
let s3 = new AWS.S3({signatureVersion: 'v4'})

const STAGE = getStage()

const BUCKETS = {
  CODE: 'fulfilment-export-code',
  PROD: 'fulfilment-export-prod'
}

const getBucket = async () => BUCKETS[await STAGE]

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

export async function upload (source: Buffer | string | Readable, filename: string | Filename, folder: ?S3Folder): Promise<S3UploadResponse> {
  let outputLocation = getFilename(filename)
  let bucket = await getBucket()
  let key = folder ? `${folder.prefix}${outputLocation}` : outputLocation
  console.log(`uploading to ${bucket}/${key}`)

  let params = {
    Bucket: bucket,
    Key: key,
    Body: source,
    ServerSideEncryption: 'aws:kms'
  }
  let upload = s3.upload(params)
  if (upload == null) {
    throw new NamedError('S3 error', 's3.upload returned null, this should never happen')
  }
  let result = await upload.promise()
  if (result.Location == null || result.ETag == null || result.Bucket == null || result.Key == null) {
    console.log(result)
    throw new NamedError('S3 error', 's3.upload.promise has missing fields, this should never happen')
  }
  return result
}

export async function createReadStream (path: string) {
  let bucket = await getBucket()
  console.log(`reading file from ${bucket}/${path}`)
  let options = {Bucket: bucket, Key: path}

  return s3.getObject(options).createReadStream()
}

export async function getObject (path: string) {
  let bucket = await getBucket()
  let options = {Bucket: bucket, Key: path}
  console.log(`Retrieving file ${options.Key} from S3 bucket ${options.Bucket}.`)
  return s3.getObject(options).promise()
}

export async function copyObject (sourcePath: string, destPath: string) {
  let bucket = await getBucket()
  let options = {
    Bucket: bucket,
    CopySource: `${bucket}/${sourcePath}`,
    Key: destPath,
    ServerSideEncryption: 'aws:kms'
  }
  console.log(`copying file ${bucket}/${sourcePath} to ${bucket}/${destPath}`)
  return s3.copyObject(options).promise()
}

export async function getFileInfo (path: string) {
  let bucket = await getBucket()

  let options = {Bucket: bucket, Key: path}
  console.log(`Retrieving information for file ${options.Key} from S3 bucket ${options.Bucket}.`)
  return s3.headObject(options).promise()
}

function getFilename (f: string | Filename) {
  if (f instanceof Filename) {
    return f.filename
  }
  return f
}
