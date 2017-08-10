// @flow

import { NamedError } from './lib/NamedError'
import { homedeliveryQuery } from './homedelivery/query'
import { weeklyQuery } from './weekly/query'
import type { fulfilmentType } from './lib/config'
import type {input as output} from './fetcher'
export type input = {
  type: fulfilmentType,
  deliveryDate: ?string,
  deliveryDateDaysFromNow: ?number
}
export function handler (input: ?input, context:?any, callback:Function) {
  if (input == null) {
    callback(new NamedError('inputerror', 'Input to fetcher was invalid'))
    return null
  }
  asyncHandler(input).then(res => callback(null, {...input, jobId: res.jobId, deliveryDate: res.deliveryDate}))
    .catch(error => callback(error))
}
async function asyncHandler (input: input): Promise<output> {
  if (input.type === 'homedelivery') {
    return homedeliveryQuery(input)
  }
  if (input.type === 'weekly') {
    return weeklyQuery(input)
  }
  throw NamedError('notype', 'No valid fulfilment type was found in input')
}
