// @flow
import AWS from 'aws-sdk'
import csv from 'fast-csv'
import {fetchConfig} from './lib/config'
import intersectionWith from 'lodash/intersectionWith'
import differenceWith from 'lodash/differenceWith'
import diff from 'deep-diff'
import type {Difference} from 'deep-diff'
import QuoteRemover from './lib/QuoteRemover'

type S3Path = {
  Bucket: string,
  Key: string
}

const s3 = new AWS.S3({ signatureVersion: 'v4' })

export function handler (input:?any, context:?any, callback:Function) {
  compare().then((result) => callback(null, {...input, ...result})).catch((e) => {
    console.log(e)
    callback(e)
  })
}

async function compare () {
  let config = await fetchConfig()
  const bucket = 'fulfilment-output-test'
  const sfprefix = `${config.stage}/salesforce_output/`
  const guprefix = `${config.stage}/fulfilment_output/`
  const logprefix = `${config.stage}/comparator_output/`

  console.log('Fetching existing files in S3: ', bucket)
  console.log(sfprefix)
  const sfresp = await s3.listObjectsV2({
    Bucket: bucket,
    Prefix: sfprefix
  }).promise()
  const sfkeys = sfresp.Contents.map(r => { return r.Key.slice(sfprefix.length) }).filter(notEmpty)
  console.log('Found the following salesforce files', sfkeys)
  console.log(guprefix)
  const guresp = await s3.listObjectsV2({
    Bucket: bucket,
    Prefix: guprefix
  }).promise()
  const gukeys = guresp.Contents.map(r => { return r.Key.slice(guprefix.length) }).filter(notEmpty)
  console.log('Found the following fulfilment files', gukeys)
  console.log(logprefix)
  const logresp = await s3.listObjectsV2({
    Bucket: bucket,
    Prefix: logprefix
  }).promise()
  const logkeys = logresp.Contents.map(r => { return r.Key.slice(guprefix.length) })
  console.log('Found the following log files', logkeys)

  const joint = intersectionWith(gukeys, sfkeys, (a:string, b:string) => {
    return a.split('_').join('') === b.split('_').join('')
  })
  console.log('In both systems', joint)

  const unchecked = differenceWith(joint, logkeys, (a, b) => {
    return b === logFileNameFor(a)
  })
  console.log('remaining to check', unchecked)

  if (unchecked.length === 0) {
    return 'No files found to check.'
  }

  async function check (filename: string) {
    let sfPath = {Bucket: bucket, Key: `${sfprefix}${sfFilenameFor(filename)}`}
    let guPath = {Bucket: bucket, Key: `${guprefix}${filename}`}
    let logPath = {Bucket: bucket, Key: `${logprefix}${logFileNameFor(filename)}`}

    let logCache = []

    let log = (entry:string) => {
      if (config.stage === 'CODE') {
        console.log(entry)
      }
      logCache.push(entry)
    }

    let sfOutput = await fetchCSV(sfPath)
    let guOutput = await fetchCSV(guPath)

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
      let differences: ?Array<Difference> = diff(s[0], g[0])
      if (differences != null) {
        renderDifference(differences).map(log)
      }
    })
// At this stage, this only includes keys not present in salesforce file
    Object.keys(guOutput).forEach((id) => {
      log(`${id} found in fulfilment file but not in Salesforce output.`)
    })
    return s3.upload({
      ACL: 'private',
      ServerSideEncryption: 'aws:kms',
      Body: logCache.join('\n'),
      ...logPath
    }).promise()
  }

  let checked = unchecked.map(check)
  return Promise.all(checked)
}

function notEmpty (str) {
  return str.length > 0
}

function fetchCSV (path: S3Path) {
  type customer = {'Customer Reference':string}
  // Flow note: at least this field is required, more still meets type
  let customers: {[string]:Array<customer>} = {}
  console.log(`Fetching ${path.Key} from ${path.Bucket}`)
  let csvStream = s3.getObject(path).createReadStream()
  console.log('Initialising parser.')
  return new Promise((resolve, reject) => {
    let reader = csv.parse({headers: true}).on('data', (data:customer) => {
      let id = data['Customer Reference']
      if (id in customers) {
        console.log(`Duplicate id found ${id}`)
        customers[id].push(data)
        return
      }
      customers[id] = [data]
    }).on('end', () => {
      resolve(customers)
    })
    csvStream.pipe(new QuoteRemover()).pipe(reader)
  })
}

function sfFilenameFor (filename:string) {
  let arr = filename.split('_')
  /* From
   * 'HOME_DELIVERY_Wednesday_25_01_2017.csv'
   *   0      1       2        3  4   5
   * To
   * 'HOME_DELIVERY_Wednesday25_01_2017.csv'
   */
  return `${arr[0]}_${arr[1]}_${arr[2]}${arr[3]}_${arr[4]}_${arr[5]}`
}

function logFileNameFor (filename: string) {
  return filename.replace('csv', 'log')
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
          return `Field ${path} changed from ${d.lhs} to ${d.rhs}`
      }
    }
    return `Unidentified change at ${path}`
  })
}
