// @flow

import { fetchConfig } from '../lib/config'
import { uploadFiles } from '../lib/salesforceUpload'
import { authenticate } from '../lib/salesforceAuthenticator'
import moment from 'moment'

type weeklyUploaderInput = {
  deliveryDate: string
}

function getDeliveryDate (input: weeklyUploaderInput) {
  if (!input.deliveryDate) {
    throw new Error('deliveryDate must be in the format "YYYY-MM-DD"')
  }
  let deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD')
  if (!deliveryDate.isValid()) {
    throw new Error('deliveryDate must be in the format "YYYY-MM-DD"')
  }
  return deliveryDate
}

async function asyncHandler (input: weeklyUploaderInput) {
  let config = await fetchConfig()
  let salesforce = await authenticate(config)

  console.log('Config fetched successfully.')
  let deliveryDate = getDeliveryDate(input)
  console.log(`delivery date is ${input.deliveryDate}`)
  return uploadFiles(config, salesforce, 'weekly', deliveryDate)
}

export function handler (input: weeklyUploaderInput, context: any, callback: (error: any, response: any) => void) {
  asyncHandler(input)
    .then(uploadedFiles => {
      console.log('returning success ')
      callback(null, uploadedFiles)
    })
    .catch(error => {
      console.log(error)
      callback(null, error)
    })
}
