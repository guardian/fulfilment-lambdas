// @flow
import { fetchConfig } from './lib/config'
import AWS from 'aws-sdk'
import NamedError from './lib/NamedError'
import { authenticate } from './lib/salesforceAuthenticator'

const s3 = new AWS.S3({ signatureVersion: 'v4' })
const BUCKET = 'fulfilment-output-test'

export function handler (input:?any, context:?any, callback:Function) {
  if (input == null || typeof input.path !== 'string') {
    callback(new NamedError('inputError', 'Input did not contain filename'))
    return
  }

  if (input.preventUpload !== null && input.preventUpload) {
    callback(new NamedError('preventUploadError', 'Upload to salesforce disabled.'))
    return
  }
  callback(new NamedError('inputError', 'Input did not contain filename'))

  uploader(input).then((r) => {
    console.log(r)
    console.log('success')
    callback(null, {...input, ...r})
  }).catch(e => {
    console.log('oh no  ')
    console.log(e)
    callback(e)
  })
}

async function uploader (input: { path: string }) {
  const config = await fetchConfig()
  const salesforce = await authenticate(config)
  console.log('Finding fulfilment folder.')
  const folder = config.salesforce.uploadFolder
  console.log(folder)
  // get file from s3 as stream

  let options = { Bucket: BUCKET, Key: `${config.stage}/${input.path}` }
  console.log(`Retreiving file ${options.Key} from S3 bucket ${options.Bucket}.`)
  let fileToUpload = await s3.getObject(options).promise()

  // build a little json
  let message = {
    'Description': `Home Delivery Fulfilment file ${input.path}`,
    'Keywords': 'fulfilment',
    'FolderId': folder,
    'Name': input.path,
    'Type': 'csv'
  }
  console.log('Building SF upload.')

  let url = '/services/data/v23.0/sobjects/Document/' // NOT FOR UPDATING

  // don't try to make the form with a stream from s3 or by appending form sections
  let form = {
    entity_document: {
      value: JSON.stringify(message),
      options: {
        contentType: 'application/json'
      }
    },
    Body: { value: fileToUpload.Body, options: { contentType: 'text/csv', filename: input.path } }
  }

  return salesforce.post(url, form)

  // make a request! https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_sobject_insert_update_blob.htm
}
