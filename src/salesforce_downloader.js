// @flow
import { fetchConfig } from './lib/config'
import { authenticate } from './lib/salesforceAuthenticator'
import type { folder } from './lib/salesforceAuthenticator'
import type { S3Folder } from './lib/storage'
import type { Config } from './lib/config'
import { ls, upload } from './lib/storage'

import stream from 'stream'

export function handler (input:?any, context:?any, callback:Function) {
  downloader().then((r) => {
    console.log(r)
    console.log('success')
    callback(null, {...input, ...r})
  }).catch(e => {
    console.log('oh no  ')
    callback(e)
  })
}

async function downloader () {
  console.log('Fetching config from S3.')
  let config = await fetchConfig()

  console.log('Getting home delivery folder')
  let folders = config.downloadFolders
  return folders.map(folder => download(config, folder))
}

async function download (config: Config, folder: folder & S3Folder) {
  let salesforce = await authenticate(config)

  console.log('Fetching existing files in S3: ', folder.bucket, folder.prefix)
  const contents = await ls(folder)

  let keys = contents.map(r => { return r.Key.slice(folder.prefix.length) })

  console.log('Fetching file list from Saleforce.')
  let documents = await salesforce.getDocuments(folder)
  console.log('Ignoring existing files:', keys)

  let filtered = documents.filter((d) => {
    return !keys.includes(d.Name)
  })

  let uploads = filtered.map(doc => {
    console.log('Starting download of ', doc.Name)
    let dl = salesforce.getStream(`${doc.attributes.url}/Body`)
    let st = new stream.PassThrough()
    dl.pipe(st)
    console.log('Starting upload to S3 ')
    return upload(st, doc.Name, folder)
  })
  console.log('Performing upload/downloads.')
  let status = await Promise.all(uploads)
  return status.map(s => s.key)
}
