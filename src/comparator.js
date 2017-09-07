// @flow
import AWS from 'aws-sdk'
import csv from 'fast-csv'
import {fetchConfig} from './lib/config'
import diff from 'deep-diff'
import type {Difference} from 'deep-diff'
import QuoteRemover from './lib/QuoteRemover'
import type { S3Folder } from './lib/storage'
import type { Config, uploadDownload } from './lib/config'
import {extractFilename} from './lib/Filename'
import type {Filename} from './lib/Filename'

type S3Path = {
  Bucket: string,
  Key: string
}
type customer = {'Customer Reference':string, 'Sent Date': string }
type customersMap = {[string]:Array<customer>}
  // Flow note: at least this field is required, more still meets type

const s3 = new AWS.S3({ signatureVersion: 'v4' })

function compareSentDates (salesforceCustomersMap:customersMap, guCustomersMap:customersMap):string {
  let dateSF = salesforceCustomersMap[Object.keys(salesforceCustomersMap)[0]][0]['Sent Date']
  let dateGU = guCustomersMap[Object.keys(guCustomersMap)[0]][0]['Sent Date']
  return dateSF !== dateGU ? `Fulfilment files generated on different dates.
  Salesforce: ${dateSF}
  New Fulfilment: ${dateGU}
  ` : ''
}

export function handler (input:?any, context:?any, callback:Function) {
  compareAll().then((result) => callback(null, {...input, ...result})).catch((e) => {
    console.log(e)
    callback(e)
  })
}

function mergeAddressFields (address1: string, address2: string): any {
  let fullAddress = []
  function addParts (parts: Array<string>) {
    parts.forEach(p => {
      if (p.trim() !== '') {
        fullAddress.push(p.trim())
      }
    })
  }

  addParts(address1.split(','))
  addParts(address2.split(','))

  return fullAddress.join()
}

function normalise (entry: any) {
  let copy = {...entry}
  let address1 = entry['Customer Address Line 1'] || ''
  let address2 = entry['Customer Address Line 2'] || ''
  delete copy['Customer Address Line 1']
  delete copy['Customer Address Line 2']

  copy['Customer Address'] = mergeAddressFields(address1, address2)
  delete copy['Delivery Quantity']
  delete copy['Sent Date']
  copy['Customer Telephone'] = entry['Customer Telephone'].replace(/^0|\+44/, '')
  return copy
}
async function compareAll () {
  let config = await fetchConfig()
  let compareFulfilment = folder => compare(config, folder)
  let fulfilments = [config.fulfilments.homedelivery]//, ...Object.keys(config.fulfilments.weekly).map(k => config.fulfilments.weekly[k])]

  return Promise.all(fulfilments.map(compareFulfilment))
}
async function compare (config: Config, fulfilment: uploadDownload) {
  // Comparing the salesforce fulfilments in the download folder to the
  // ones we generated in the uploads folder.
  console.log(`Running fulfilment for ${fulfilment.downloadFolder.name}`)
  console.log(`${fulfilment.downloadFolder.name}: Fetching existing salesforce file list from S3: ${fulfilment.downloadFolder.bucket}, ${fulfilment.downloadFolder.prefix}`)
  const sfresp = await s3.listObjectsV2({
    Bucket: fulfilment.downloadFolder.bucket,
    Delimiter: '/',
    Prefix: fulfilment.downloadFolder.prefix
  }).promise()
  const sfkeys = sfresp.Contents.map(r => { return r.Key.slice(fulfilment.downloadFolder.prefix.length) }).filter(notEmpty)

  console.log(`${fulfilment.downloadFolder.name}: Fetching existing fulfilment file list from S3 ${fulfilment.uploadFolder.bucket}, ${fulfilment.uploadFolder.prefix}`)
  const guresp = await s3.listObjectsV2({
    Bucket: fulfilment.uploadFolder.bucket,
    Delimiter: '/',
    Prefix: fulfilment.uploadFolder.prefix
  }).promise()
  const gukeys = guresp.Contents.map(r => { return r.Key.slice(fulfilment.uploadFolder.prefix.length) }).filter(notEmpty)

  let logFolder: S3Folder = {
    bucket: fulfilment.downloadFolder.bucket,
    prefix: `${fulfilment.downloadFolder.prefix}logs/`
  }

  console.log(`${fulfilment.downloadFolder.name}: Fetching existing comparison file list from S3 ${logFolder.bucket}, ${logFolder.prefix}`)

  const logresp = await s3.listObjectsV2({
    Bucket: logFolder.bucket,
    Delimiter: '/',
    Prefix: logFolder.prefix
  }).promise()

  const logkeys = logresp.Contents.map(r => { return r.Key.slice(logFolder.prefix.length) }).filter(notEmpty)

  let sfFiles: Array<Filename> = sfkeys.map(extractFilename).filter(notEmpty)
  let guFiles: Array<Filename> = gukeys.map(extractFilename).filter(notEmpty)
  let logFiles: Array<Filename> = logkeys.map(extractFilename).filter(notEmpty)

  // Check all future dated logfiles every time we run, just to make sure we haven't missed an update.

  console.log(`${fulfilment.downloadFolder.name}: Found the following salesforce fulfilments:`, sfFiles.map(f => `${f.filename} ${f.formatDate()}`))
  console.log(`${fulfilment.downloadFolder.name}: Found the following fulfilments:`, guFiles.map(f => `${f.filename} ${f.formatDate()}`))
  console.log(`${fulfilment.downloadFolder.name}: Found the following logs:`, logFiles.map(f => `${f.filename} ${f.formatDate()}`))

  let sfMap:Map<string, Filename> = new Map(sfFiles.map(f => [f.formatDate(), f])) // TODO: use the date as string

  let filteredGuFiles: Array<Filename> = guFiles.filter(f => sfMap.has(f.formatDate()))

  let combined = new Map(filteredGuFiles.map(f => {
    return [f.formatDate(), {salesforce: sfMap.get(f.formatDate()), fulfilment: f}]
  }))

  const unchecked = new Map(combined)
  logFiles.forEach(l => unchecked.delete(l.formatDate()))
  console.log('remaining to check', unchecked)

  if (unchecked.size === 0) {
    return {message: 'No files found to check.'}
  }

  async function check (pair: {salesforce: ?Filename, fulfilment: ?Filename}) {
    if (pair == null || pair.salesforce == null || pair.fulfilment == null) {
      console.log('null check failed')
      return
    }
    let sfPath = {Bucket: fulfilment.downloadFolder.bucket, Key: `${fulfilment.downloadFolder.prefix}${pair.salesforce.filename}`}
    let guPath = {Bucket: fulfilment.uploadFolder.bucket, Key: `${fulfilment.uploadFolder.prefix}${pair.fulfilment.filename}`}
    let logPath = {Bucket: logFolder.bucket, Key: `${logFolder.prefix}${pair.fulfilment.asLogFile()}`}

    let logCache = []

    let log = (entry:string) => {
      if (config.stage === 'CODE') {
        console.log(entry)
      }
      logCache.push(entry)
    }

    let sfOutput:customersMap = await fetchCSV(sfPath)
    let guOutput:customersMap = await fetchCSV(guPath)

    log(compareSentDates(sfOutput, guOutput))
    Object.keys(sfOutput).forEach((id) => {
      if (guOutput[id] === undefined || guOutput[id] == null) {
        log(`Subscription ${id} found in Salesforce Output, but not fulfilment file.`)
        return
      }
      let s = sfOutput[id]
      let g = guOutput[id]
      delete guOutput[id] // Removes keys from gu if they're in salesforce fulfilment
      if (s.length !== g.length) {
        log(`Differing numbers of fulfilments generated for ${id}. Salesforce: ${s.length} File: ${g.length}`)
        return
      }
      if (s.length > 1) {
        log(`Multiple subscriptions for ${id} comparing [0] against [0]`)
      }
      let differences: ?Array<Difference> = diff(normalise(s[0]), normalise(g[0]))
      if (differences != null) {
        renderDifference(differences).map(s => `${id}: ${s}`).map(log)
      }
    })
// At this stage, this only includes keys not present in salesforce file
    Object.keys(guOutput).forEach((id) => {
      log(`${id} found in fulfilment file but not in Salesforce output.`)
    })
    console.log(`now i'd upload to ${logPath.Key}`)

    return s3.upload({
      ACL: 'private',
      ServerSideEncryption: 'aws:kms',
      Body: logCache.join('\n'),
      ...logPath
    }).promise()
  }

  let checked = [ ...unchecked.values() ].map(check)
  return Promise.all(checked)
}

function notEmpty (str: ?string):boolean {
  return !str == null || !!str
}

function fetchCSV (path: S3Path):Promise<customersMap> {
  let customers: {[string]:Array<customer>} = {}
  console.log(`Fetching ${path.Key} from ${path.Bucket}`)
  let csvStream = s3.getObject(path).createReadStream()
  console.log('Initialising parser.')
  return new Promise((resolve, reject) => {
    let line = 0
    let reader = csv.parse({headers: true}).on('data-invalid', function (data) {
      console.log('ignoring invalid data: ' + data)
    }).on('data', (data:customer) => {
      line++
      if (data['Customer Reference'] == null) {
        console.log(`No customer ref on line ${line}`)
        return
      }
      let id = data['Customer Reference']
      if (id in customers) {
        console.log(`Duplicate id found ${id}`)
        customers[id].push(data)
        return
      }
      customers[id] = [data]
    }).on('end', () => {
      resolve(customers)
    }).on('error', e => {
      console.log(`Experienced an error on line ${line + 2}:\n ${e}`)
      // add one for the header row, and another to get to the next line
    })

    csvStream.pipe(new QuoteRemover()).pipe(reader)
  })
}

function renderDifference (diff: Array<Difference>):Array<string> {
  return diff.map((d:Difference) => {
    let path = d.path.join()
    if (typeof d.lhs === 'string' && typeof d.rhs === 'string') {
      switch (d.kind) {
        case 'N':
          return `New field found at ${path}`
        case 'D':
          return `Field deleted from ${path} `
        case 'E':
          return `Field ${path} changed from "${d.lhs}" to "${d.rhs}"`
      }
    }
    return `Unidentified change at ${path}`
  })
}
