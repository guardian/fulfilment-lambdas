import { fetchConfig } from './config'
import request from 'request'
import rp from 'request-promise-native'
import AWS from 'aws-sdk'
import stream from 'stream'

let s3 = new AWS.S3({ signatureVersion: 'v4' })

export function handler (input, context, callback) {
  q().then((r) => {
    console.log(r)
    console.log('success')
    callback(null, r)
  }).catch(e => {
    console.log('oh no  ')
    callback(e)
  })
}

async function authenticate (config) {
  console.log('Authenticating with Salesforce.')
  let url = `https://${config.salesforce.api.salesforceUrl}/services/oauth2/token`
  let auth = {
    'grant_type': 'password',
    'client_id': config.salesforce.api.consumer_key,
    'client_secret': config.salesforce.api.consumer_secret,
    'username': config.salesforce.api.username,
    'password': `${config.salesforce.api.password}${config.salesforce.api.token}`
  }
  let result = await rp.post(url, { form: auth })
  let j = JSON.parse(result)
  return {
    get: function (endpoint: string) {
      return request.get({ uri: `${j.instance_url}${endpoint}`, headers: { 'Authorization': `Bearer ${j.access_token}` } })
    },
    getp: async function (endpoint: string) {
      return rp.get({ uri: `${j.instance_url}${endpoint}`, headers: { 'Authorization': `Bearer ${j.access_token}` } })
    }
  }
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
  console.log('Fetching file list from Salesforce.')
  let documentQuery = await sf.getp(`/services/data/v20.0/query?q=SELECT Id, Name FROM Document WHERE FolderId= '00lg0000000QnEL'`)
  console.log('Parsing response.')
  let {records: documents} = JSON.parse(documentQuery)
  console.log('Ignoring existing files:', keys)

  let filtered = documents.filter((d) => {
    return !keys.includes(d.Name)
  })

  let uploads = filtered.map(doc => {
    console.log('Starting download of ', doc.Name)
    let dl = sf.get(`${doc.attributes.url}/Body`)
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
