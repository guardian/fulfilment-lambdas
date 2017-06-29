// @flow
import { fetchConfig } from './lib/config'
import { authenticate } from './lib/salesforceAuthenticator'
import AWS from 'aws-sdk'
import stream from 'stream'
let s3 = new AWS.S3({ signatureVersion: 'v4' })

export function handler (input:?any, context:?any, callback:Function) {
  q().then((r) => {
    console.log(r)
    console.log('success')
    callback(null, r)
  }).catch(e => {
    console.log('oh no  ')
    callback(e)
  })
}

async function q () {
  console.log('Fetching config from S3.')
  let config = await fetchConfig()

  const prefix = `${config.stage}/salesforce_output/`
  const bucket = 'fulfilment-output-test'

  console.log('Fetching existing files in S3: ', bucket, prefix)
  const resp = await s3.listObjectsV2({
    Bucket: bucket,
    Prefix: prefix
  }).promise()

  let keys = resp.Contents.map(r => { return r.Key.slice(prefix.length) })

  let sf = await authenticate(config)
  console.log('Getting home delivery folder')
  let folder = await sf.getFolderId('HOME_DELIVERY_FULFILMENT')
  console.log('Fetching file list from Salesforce.')
  let documents = await sf.getDocuments(folder)
  console.log('Ignoring existing files:', keys)

  let filtered = documents.filter((d) => {
    return !keys.includes(d.Name)
  })

  let uploads = filtered.map(doc => {
    console.log('Starting download of ', doc.Name)
    let dl = sf.getStream(`${doc.attributes.url}/Body`)
    let st = new stream.PassThrough()
    dl.pipe(st)
    let params = {
      ACL: 'private',
      Bucket: bucket,
      Key: `${prefix}${doc.Name}`,
      ServerSideEncryption: 'aws:kms',
      Body: st
    }
    console.log('Starting upload to S3 ', params.Key)
    return s3.upload(params).promise()
  })
  console.log('Performing upload/downloads.')
  let status = await Promise.all(uploads)
  return status.map(s => s.key)
}
