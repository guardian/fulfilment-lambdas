// @flow
import AWS from 'aws-sdk'
import csv from 'fast-csv'
import {fetchConfig} from './lib/config'
import intersectionWith from 'lodash/intersectionWith'
import differenceWith from 'lodash/differenceWith'
import diff from 'deep-diff'
import type {Difference} from 'deep-diff'
import QuoteRemover from './lib/QuoteRemover'
import {OUTPUT_DATE_FORMAT, outputFileName, logFileName, salesforceFileName, outputDate, logDate, salesforceDate} from './lib/filenames'
import moment from 'moment'
type S3Path = {
  Bucket: string,
  Key: string
}
type customer = {'Customer Reference':string, 'Sent Date': string }
type customersMap = {[string]:Array<customer>}
  // Flow note: at least this field is required, more still meets type

const s3 = new AWS.S3({ signatureVersion: 'v4' })
const sameDay = (a:moment, b:moment) => a.isSame(b, 'day')
const inFuture: (moment) => boolean = (() => {
  let now = moment()
  return (dt: moment) => dt.isAfter(now, 'day')
})()

function compareSentDates (salesforceCustomersMap:customersMap, guCustomersMap:customersMap):string {
  let dateSF = salesforceCustomersMap[Object.keys(salesforceCustomersMap)[0]][0]['Sent Date']
  let dateGU = guCustomersMap[Object.keys(guCustomersMap)[0]][0]['Sent Date']
  return dateSF !== dateGU ? `Fulfilment files generated on different dates.
  Salesforce: ${dateSF}
  New Fulfilment: ${dateGU}
  ` : ''
}

export function handler (input:?any, context:?any, callback:Function) {
  compare().then((result) => callback(null, {...input, ...result})).catch((e) => {
    console.log(e)
    callback(e)
  })
}

function normalise (entry: any) {
  let copy = {...entry}
  delete copy['Delivery Quantity']
  delete copy['Sent Date']
  copy['Customer Telephone'] = entry['Customer Telephone'].replace(/^0|\+44/, '')
  return copy
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

  console.log(guprefix)
  const guresp = await s3.listObjectsV2({
    Bucket: bucket,
    Prefix: guprefix
  }).promise()
  const gukeys = guresp.Contents.map(r => { return r.Key.slice(guprefix.length) }).filter(notEmpty)
  console.log(logprefix)
  const logresp = await s3.listObjectsV2({
    Bucket: bucket,
    Prefix: logprefix
  }).promise()
  const logkeys = logresp.Contents.map(r => { return r.Key.slice(guprefix.length) }).filter(notEmpty)

  let sfDates: Array<moment> = sfkeys.map(salesforceDate).filter(notEmpty)
  let guDates: Array<moment> = gukeys.map(outputDate).filter(notEmpty)

  let logDates: Array<moment> = logkeys.map(logDate).filter(notEmpty).filter(inFuture)
  // Check all future dated logfiles every time we run, just to make sure we haven't missed an update.

  console.log('Found the following salesforce fulfilments', sfDates.map(d => d.format(OUTPUT_DATE_FORMAT)))
  console.log('Found the following fulfilments', guDates.map(d => d.format(OUTPUT_DATE_FORMAT)))
  console.log('Found the following logs', logDates.map(d => d.format(OUTPUT_DATE_FORMAT)))

  const joint:Array<moment> = intersectionWith(guDates, sfDates, sameDay)
  console.log('In both systems', joint.map(d => d.format(OUTPUT_DATE_FORMAT)))

  const unchecked = differenceWith(joint, logDates, sameDay)
  console.log('remaining to check', unchecked.map(d => d.format(OUTPUT_DATE_FORMAT)))

  if (unchecked.length === 0) {
    return {message: 'No files found to check.'}
  }

  async function check (filename: string) {
    let sfPath = {Bucket: bucket, Key: `${sfprefix}${salesforceFileName(filename)}`}
    let guPath = {Bucket: bucket, Key: `${guprefix}${outputFileName(filename)}`}
    let logPath = {Bucket: bucket, Key: `${logprefix}${logFileName(filename)}`}

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

function notEmpty (str: ?string):boolean {
  return !!str
}

function fetchCSV (path: S3Path):Promise<customersMap> {
  let customers: {[string]:Array<customer>} = {}
  console.log(`Fetching ${path.Key} from ${path.Bucket}`)
  let csvStream = s3.getObject(path).createReadStream()
  console.log('Initialising parser.')
  return new Promise((resolve, reject) => {
    let line = 0
    let reader = csv.parse({headers: true}).on('data-invalid', function (data) {
        // TODO CAN WE LOG PII?
      console.log('ignoring invalid data: ' + data)
    }).on('data', (data:customer) => {
      line++
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
