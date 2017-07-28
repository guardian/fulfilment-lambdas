import { fetchConfig } from './lib/config'
import NamedError from './lib/NamedError'
import { upload } from './lib/storage'
import {Zuora} from './lib/zuora'

function uploadFile (fileData, config) {
  let promise = new Promise((resolve, reject) => {
    let savePath = `${config.stage}/zuoraExport/${fileData.fileName}`
    upload(fileData.data, savePath, function (err, data) {
      if (err) {
        reject(new NamedError('s3_upload_error', 'ERROR uploading results to S3 ' + err))
      } else {
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

export function handler (input, context, callback) {
  asyncHandler(input).then(res => callback(null, { ...input, deliveryDate: input.deliveryDate, results: res })).catch(e => {
    console.log(e)
    callback(e)
  })
}

async function asyncHandler (input) {
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  let zuora = new Zuora(config)
  let batches = await zuora.getJobResult(input.jobId, config)
  console.log('Job results returned.')
  let files = batches.map(batch => zuora.fetchFile(batch, input.deliveryDate, config))
  console.log('Downloading job results.')
  let uploads = await Promise.all(files)
  console.log('Generating upload')
  let result = uploads.map(data => uploadFile(data, config))
  console.log('Returning.')
  return Promise.all(result)
}
