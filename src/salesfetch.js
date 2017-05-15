import { fetchConfig } from './config'
import request from 'request'
import rp from 'request-promise-native'
import AWS from 'aws-sdk'

let s3 = new AWS.S3({ signatureVersion: 'v4' })

export function handler (input, context, callback) {
  q().then(console.log).catch(console.error)
}

async function authenticate () {
  let config = await fetchConfig()
  let url = `https://${config.salesforce.api.salesforceUrl}/services/oauth2/token`
  let auth = {
    'grant_type': 'password',
    'client_id': config.salesforce.api.consumer_key,
    'client_secret': config.salesforce.api.consumer_secret,
    'username': config.salesforce.api.username,
    'password': `${config.salesforce.api.password}${config.salesforce.api.token}`
  }
  let result = await rp.post(url, { form: auth })
  console.log(result)
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
  let keys = await s3.listObjectsV2({
    Bucket: 'fulfilment-private',
    Prefix: '???'
  }).promise()
  let sf = await authenticate()
  let documentQuery = await sf.getp(`/services/data/v20.0/query?q=SELECT Id, Name FROM Document WHERE FolderId= '00lg0000000QnEL'`)
  let {records: documents} = JSON.parse(documentQuery)

  documents.filter(document => {
      // Not in keys
  }).map(document => {
      // make s3 upload pipe
    sf.get(document.attributes.url).pipe(process.stdout)
  })
}
