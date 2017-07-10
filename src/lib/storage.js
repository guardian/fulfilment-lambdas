import AWS from 'aws-sdk'
let s3 = new AWS.S3({signatureVersion: 'v4'})
const BUCKET = 'fulfilment-output-test'

export function upload (stream, outputLocation, callback) {
  console.log(`uploading to ${BUCKET}/${outputLocation}`)

  let params = {
    Bucket: BUCKET,
    Key: outputLocation,
    Body: stream,
    ServerSideEncryption: 'aws:kms'
  }
  s3.upload(params).send(callback)
}

export function createReadStream (path) {
  console.log(`reading file from ${BUCKET}/${path}`)
  let options = {Bucket: BUCKET, Key: path}

  return s3.getObject(options).createReadStream()
}
