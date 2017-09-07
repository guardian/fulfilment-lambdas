// @flow
import type {Config} from './config'
import request from 'request'
import NamedError from './NamedError'

export type Query = {
  'name':string,
  'query':string
}

type Batch = {
  'name':string,
  'status':string,
  'fileId':string
}

export type FileData = {
            batchName: string,
            fileName: string,
            data: Buffer
          }

export class Zuora {
  authorization :{Authorization:string}
  config: Config
  constructor (config:Config) {
    this.authorization = {'Authorization': 'Basic ' + Buffer.from(`${config.zuora.api.username}:${config.zuora.api.password}`).toString('base64')}
    this.config = config
  }
  async query (name:string, ...queries:Array<Query>) {
    const exportQueries = queries.map((q) => { return {...q, 'type': 'zoqlexport'} })
    const options = {
      method: 'POST',

      uri: `${this.config.zuora.api.url}/apps/api/batch-query/`,
      json: true,
      body: {
        'format': 'csv',
        'version': '1.0',
        'name': 'Fulfilment-Queries',
        'encrypted': 'none',
        'useQueryLabels': 'true',
        'dateTimeUtc': 'true',
        'queries': exportQueries
      },
      headers: {
        ...this.authorization,
        'Content-Type': 'application/json'
      }
    }
    let promise = new Promise((resolve, reject) => {
      request(options, function (error, response, body) {
        if (error) {
          reject(error)
          return
        }

        console.log('statusCode:', response && response.statusCode)

        if (response.statusCode !== 200) {
          reject(new NamedError('api_call_error', `error response status ${response.statusCode}`))
        } else if (body.errorCode) {
          reject(new NamedError('api_call_error', `zuora error! code: ${body.errorCode} : ${body.message}`))
        } else {
          resolve(body.id)
        }
      })
    })
    return promise
  }
  fetchFile (batch: Batch, deliveryDate: string): Promise<FileData> {
    return new Promise((resolve, reject) => {
      console.log(`fetching file from zuora with id ${batch.fileId}`)
      const options = {
        method: 'GET',
        uri: `${this.config.zuora.api.url}/apps/api/batch-query/file/${batch.fileId}`,
        json: true,
        headers: {
          ...this.authorization,
          'Content-Type': 'application/json'
        }
      }
      request(options, function (error, response, body) {
        if (error) {
          reject(new NamedError('api_call_error', error))
          return
        }
        if (response.statusCode !== 200) {
          reject(new NamedError('api_call_error', `error response status ${response.statusCode} when getting batch ${batch.name}`))
        } else {
        // TODO SEE HOW TO DETECT FAILURES OR ANY OTHER SPECIAL CASE HERE
          let fileData = {
            batchName: batch.name,
            fileName: `${batch.name}_${deliveryDate}_${batch.fileId}.csv`,
            data: body
          }
          resolve(fileData)
        }
      })
    })
  }
  getJobResult (jobId: string) : Promise<Array<Batch>> {
    return new Promise((resolve, reject) => {
      console.log(`getting job results for jobId=${jobId}`)
      const options = {
        method: 'GET',
        uri: `${this.config.zuora.api.url}/apps/api/batch-query/jobs/${jobId}`,
        json: true,
        headers: {
          ...this.authorization,
          'Content-Type': 'application/json'
        }
      }
      request(options, (error, response, body) => {
        console.log('Job result received.')
        if (error) {
          reject(new NamedError('api_call_error', error))
          return
        }

        if (response.statusCode !== 200) {
          reject(new NamedError('api_call_error', `error response status ${response.statusCode} while getting job result`))
        } else if (body.status !== 'completed') {
          if (body.status !== 'error' && body.status !== 'aborted') {
            reject(new NamedError('zuora_job_pending', `job status was ${body.status} api call should be retried later`))
          } else {
            reject(new NamedError('api_call_error', `job status was ${body.status} expected completed`))
          }
        } else {
        // TODO SEE HOW TO DETECT FAILURES OR ANY OTHER SPECIAL CASE HERE
          let notCompleted = body.batches.filter(batch => batch.status !== 'completed').map(batch => `${batch.name} is in status: ${batch.status}`)
          if (notCompleted.length > 1) {
            reject(new NamedError('batch_not_completed', notCompleted.join()))
          }
          resolve(body.batches)
        }
      })
    })
  }
}
