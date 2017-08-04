// @flow
import { fetchConfig } from './lib/config'
import NamedError from './lib/NamedError'
import { upload } from './lib/storage'
import {Zuora} from './lib/Zuora'
type input = {jobId: string, deliveryDate: string}

async function uploadFile (fileData, config) {
  let savePath = `${config.stage}/zuoraExport/${fileData.fileName}`
  return upload(fileData.data, savePath)
}

export function handler (input: ?any, context: ?any, callback: Function) {
  if (input == null ||
    input.jobId == null ||
     typeof input.jobId !== 'string' ||
     input.deliveryDate == null ||
     typeof input.deliveryDate !== 'string') {
    callback(new NamedError('inputerror', 'Input to fetcher was invalid'))
    return null
  }
  asyncHandler(input).then(res => callback(null, { ...input, results: res })).catch(e => {
    console.log(e)
    callback(e)
  })
}
async function asyncHandler (input: input) {
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  let zuora = new Zuora(config)
  let batches = await zuora.getJobResult(input.jobId)
  console.log('Job results returned.')
  let files = batches.map(batch => zuora.fetchFile(batch, input.deliveryDate))
  console.log('Downloading job results.')
  let uploads = await Promise.all(files)
  console.log('Generating upload')
  let result = uploads.map(data => uploadFile(data, config))
  console.log('Returning.')
  return Promise.all(result)
}
