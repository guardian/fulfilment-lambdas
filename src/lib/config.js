// @flow
import AWS from 'aws-sdk'
import NamedError from './NamedError'
import type {folder} from './salesforceAuthenticator'
import type {S3Folder} from './storage'

let s3 = new AWS.S3()

export type Stage = 'CODE' | 'PROD'
const stages: Array<Stage> = ['CODE', 'PROD']

export type Config = {
  stage: Stage,
  zuora: {
    api: {
      url: string,
      username: string,
      password: string
    }
  },
  salesforce: {
    api: {
      consumer_key: string,
      consumer_secret: string,
      username: string,
      password: string,
      token: string,
      salesforceUrl: string
    },
      uploadFolder: folder,
      downloadFolder: folder
  },
  api: {
    expectedToken: string
  },
  downloadFolders: Array<folder & S3Folder>
}

export function getStage (): Promise<Stage> {
  return new Promise((resolve, reject) => {
    let stage = stages.find((stage) => { return stage === process.env.Stage })
    if (stage) {
      resolve(stage)
    } else {
      reject(new Error(`invalid stage: ${process.env.Stage || 'not found'}, please fix Stage env variable`))
    }
  })
}

function fetchConfigForStage (stage: Stage): Promise<Config> {
  console.log('Fetching configuration file from S3.')
  return new Promise((resolve, reject) => {
    const key = 'fulfilment.private.json'
    const bucket = `fulfilment-private/${stage}`
    console.log(`loading ${stage} configuration from ${bucket}/${key}`)

    s3.getObject(
            { Bucket: bucket, Key: key },
            function (err, data) {
              if (err) { reject(new NamedError('s3_download_error', `Error fetching config for S3 : ${err}`)) } else {
                let json = JSON.parse(Buffer.from(data.Body))
                console.log('Config succesfully downloaded and parsed.')
                resolve({
                  stage: stage,
                  ...json
                })
              }
            })
  })
}

export function fetchConfig (): Promise<Config> {
  return getStage().then(fetchConfigForStage)
}
