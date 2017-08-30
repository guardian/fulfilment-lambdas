// @flow
import type { fulfilmentType } from './lib/config'
import { weeklyExport } from './weekly/export'
import { homedeliveryExport } from './homedelivery/export'
import { NamedError } from './lib/NamedError'
export type result = {
  queryName: string,
  fileName: string
}
export type input = {
  deliveryDate: string,
  results: Array<result>,
  type: fulfilmentType
}

async function asyncHandler (input: input) {
  if (input.type === 'homedelivery') {
    return homedeliveryExport(input)
  }
  if (input.type === 'weekly') {
    return weeklyExport(input)
  }
  throw new Error('No valid fulfilment type was found in input')
}

export function handler (input: input, context: ?any, callback: Function) {
  if (input == null) {
    callback(new NamedError('inputerror', 'Input to fetcher was invalid'))
    return null
  }
  asyncHandler(input)
    .then(outputFileName => callback(null, {...input, fulfilmentFile: outputFileName}))
    .catch(e => {
      console.log(e)
      callback(e)
    })
}
