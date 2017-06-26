import AWS from 'aws-sdk'
import request from 'request'
import { fetchConfig } from './lib/config'
import NamedError from './lib/NamedError'

let UPLOAD_BUCKET = 'fulfilment-output-test'

let uploadS3 = new AWS.S3({ signatureVersion: 'v4' })

function fetchFile (batch, deliveryDate, config) {
  return new Promise((resolve, reject) => {
    console.log(`fetching file from zuora with id ${batch.fileId}`)
    const options = {
      method: 'GET',
      uri: `${config.zuora.api.url}/apps/api/batch-query/file/${batch.fileId}`,
      json: true,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.zuora.api.username}:${config.zuora.api.password}`).toString('base64'),
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
          fileName: `${batch.name}_${deliveryDate}.csv`,
          data: body
        }
        resolve(fileData)
      }
    })
  })
}
function uploadFile (fileData, config) {
  let promise = new Promise((resolve, reject) => {
    let savePath = `${config.stage}/zuoraExport/${fileData.fileName}`
    let params = {
      Bucket: UPLOAD_BUCKET,
      Key: savePath,
      Body: fileData.data,
      ServerSideEncryption: 'aws:kms'
    }
    uploadS3.upload(params).send(function (err, data) {
      if (err) {
        reject(new NamedError('s3_upload_error', 'ERROR uploading results to S3 ' + err))
      } else {
        console.log(`uploaded file to ${UPLOAD_BUCKET}/${savePath}`)
        let response = {
          queryName: fileData.batchName,
          fileName: fileData.fileName
        }
        resolve(response)
      }
    })
  })
  return promise
}

function getJobResult (jobId, config) {
  return new Promise((resolve, reject) => {
    console.log(`getting job results for jobId=${jobId}`)
    const options = {
      method: 'GET',
      uri: `${config.zuora.api.url}/apps/api/batch-query/jobs/${jobId}`,
      json: true,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.zuora.api.username}:${config.zuora.api.password}`).toString('base64'),
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

export function handler (input, context, callback) {
  asyncHandler(input).then(res => callback(null, { deliveryDate: input.deliveryDate, results: res })).catch(e => {
    console.log(e)
    callback(e)
  })
}

async function asyncHandler (input) {
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  let batches = await getJobResult(input.jobId, config)
  console.log('Job results returned.')
  let files = batches.map(batch => fetchFile(batch, input.deliveryDate, config))
  console.log('Downloading job results.')
  let uploads = await Promise.all(files)
  console.log('Generating upload')
  let result = uploads.map(data => uploadFile(data, config))
  console.log('Returning.')
  return Promise.all(result)
}
