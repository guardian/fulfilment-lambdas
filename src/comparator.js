import AWS from 'aws-sdk'
import csv from 'fast-csv'
import {fetchConfig} from './config'
import intersectionWith from 'lodash/intersectionWith'
import differenceWith from 'lodash/differenceWith'

type S3Path = {
  Bucket: string,
  Key: string
}

const s3 = new AWS.S3({ signatureVersion: 'v4' })

export function handler (input, context, callback) {
  compare().then((result) => callback(null, result)).catch((e) => {
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
    return a === logFileNameFor(b)
  })
  console.log('remaining to check', unchecked)

  if (unchecked.length === 0) {
    return 'No files found to check.'
  }

  let sfPath = {Bucket: bucket, Key: `${sfprefix}${sfFilenameFor(unchecked[0])}`}
  let guPath = {Bucket: bucket, Key: `${guprefix}${unchecked[0]}`}
  let logPath = {Bucket: bucket, Key: `${logprefix}${logFileNameFor(unchecked[0])}`}

  let logCache = []

  let log = (entry) => {
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
    if (s.length !== g.length) {
      log(`Differing numbers of fulfilments generated for ${id}. Salesforce: ${s.length} File: ${g.length}`)
    }
    delete guOutput[id] // Removes keys from gu if they're in salesforce fulfilment
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

function notEmpty (str) {
  return str.length > 0
}

function fetchCSV (path: S3Path) {
  type customer = {'Customer Reference':string}
  // Flow note: at least this field is required, more still meets type
  let customers: {[string]:[customer]} = {}
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
    csvStream.pipe(reader)
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
