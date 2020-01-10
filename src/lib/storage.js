// @flow
import AWS from 'aws-sdk'
import util from 'util'
import { getStage } from './config'
import { Filename } from './Filename'
import getStream from 'get-stream'
const s3 = new AWS.S3({ signatureVersion: 'v4' })

const STAGE = getStage()

// TODO maybe this could be read from the config ?
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
  const resp = await s3.listObjectsV2({
    Bucket: folder.bucket,
    Prefix: folder.prefix
  }).promise()
  return resp.Contents
}

/**
 * Upload files to S3 bucket
 */
export async function upload (source: *, filename: string | Filename, folder: ?S3Folder): Promise<S3UploadResponse> {
  // if (!source.writableEnded) throw new Error(`Failed to upload file ${filename.toString()} because stream is not finished. Make sure to .end() the stream on end event.`)
  const outputLocation = getFilename(filename)
  const bucket = await getBucket()
  const key = folder ? `${folder.prefix}${outputLocation}` : outputLocation
  console.log(`uploading to ${bucket}/${key}`)

  /**
   * WARNING: Although AWS S3.upload docs seem to indicate we can upload a stream object directly via
   * 'Body: stream' params field, it does not seem to work with the stream provided by csv-parser,
   * thus we had to convert the stream to string using get-stream package.
   */
  const streamAsString = await getStream(source)
  if (!streamAsString && key.includes('HOME_DELIVERY')) throw new Error(`${key} should not be empty!`)

  const params = {
    Bucket: bucket,
    Key: key,
    Body: streamAsString,
    ServerSideEncryption: 'aws:kms'
  }
  const uploadResponse = await s3.upload(params).promise()
  if (!uploadResponse.Location.includes(key)) {
    throw new Error(`${key} should be uploaded to S3. Response: ${util.inspect(uploadResponse)}`)
  }
  return uploadResponse
}

export async function createReadStream (path: string) {
  const bucket = await getBucket()
  console.log(`reading file from ${bucket}/${path}`)
  const options = { Bucket: bucket, Key: path }
  return s3.getObject(options).createReadStream()
}

export async function getObject (path: string) {
  const bucket = await getBucket()
  const options = { Bucket: bucket, Key: path }
  console.log(`Retrieving from S3 ${options.Bucket}/${options.Key}`)
  return s3.getObject(options).promise()
}

export async function copyObject (sourcePath: string, destPath: string) {
  const bucket = await getBucket()
  const options = {
    Bucket: bucket,
    CopySource: `${bucket}/${sourcePath}`,
    Key: destPath,
    ServerSideEncryption: 'aws:kms'
  }
  console.log(`copying file ${bucket}/${sourcePath} to ${bucket}/${destPath}`)
  return s3.copyObject(options).promise()
}

export async function getFileInfo (path: string) {
  const bucket = await getBucket()

  const options = { Bucket: bucket, Key: path }
  console.log(`Retrieving information for file ${options.Key} from S3 bucket ${options.Bucket}.`)
  return s3.headObject(options).promise()
}

function getFilename (f: string | Filename) {
  if (f instanceof Filename) {
    return f.filename
  }
  return f
}
