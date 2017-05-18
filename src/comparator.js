import AWS from 'aws-sdk'
import csv from 'fast-csv'
import {fetchConfig} from './config'
import union from 'lodash/union'
import difference from 'lodash/difference'
import type ReadableStream from 'lib/streams'
import stream from 'stream'

type S3Path = {
  Bucket: string,
  Key: string
}

const s3 = new AWS.S3({ signatureVersion: 'v4' })

export function handler (input, context, callback) {
  compare().then(() => callback(null, 'hello')).catch((e) => {
    console.log(e)
    callback(e)
  })
}

async function compare () {
  console.log('start')
  let config = await fetchConfig()
  console.log('aaa')
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

  const joint = union(sfkeys, gukeys)
  console.log('In both systems', joint)

  const unchecked = difference(joint, logkeys)
  console.log('remaining to check', unchecked)

  let sfPath = {Bucket: bucket, Key: `${sfprefix}${unchecked[0]}`}
  let guPath = {Bucket: bucket, Key: `${guprefix}${unchecked[0]}`}

  let sfOutput = await fetchCSV(sfPath)
  let guOutput = await fetchCSV(guPath)

  Object.keys(sfOutput).forEach((id) => {
    if (guOutput[id] === undefined || guOutput[id] == null) {
      console.log(`Subscription ${id} found in Salesforce Output, but not fulfilment file.`)
      return
    }
    let s = sfOutput[id]
    let g = guOutput[id]
    if (s.length !== g.length) {
      console.log(`Differing numbers of fulfilments generated for ${id}. Salesforce: ${s.length} File: ${g.length}`)
    }
    delete guOutput[id]
  })
  Object.keys(guOutput).forEach((id) => {
    console.log(`${id} found in fulfilment file but not in Salesforce output.`)
  })

  return null
//  console.log(stream)
}

function notEmpty (str) {
  return str.length > 0
}

function fetchCSV (path: S3Path) {
  let customers = {}
  let csvStream = s3.getObject(path).createReadStream()
  console.log('hey :)')
  return new Promise((resolve, reject) => {
    let reader = csv.parse({headers: true}).on('data', (data) => {
      let id = data['Customer Reference']
      if (id in customers) {
        console.log(`Duplicate id found ${id}`)
        let old = customers[id]
        customers[id] = [data, ...old]
        return
      }
      customers[id] = data
    }).on('end', () => {
      resolve(customers)
    })
    csvStream.pipe(reader)
    console.log('piped')
  })
}
