// @flow
import type { fulfilmentType } from './lib/config'
import { weeklyExport } from './weekly/export'
import { homedeliveryExport } from './homedelivery/export'

export type result = {
  queryName: string,
  fileName: string
}
export type Input = {
  deliveryDate: string,
  results: Array<result>,
  type: fulfilmentType
}

export async function handler (input: Input, context: ?any) {
  console.log('woohoo handler input =', input)
  console.log('woohoo handler context =', context)

  let outputFileName = null
  if (input.type === 'homedelivery') { outputFileName = await homedeliveryExport(input) }
  else if (input.type === 'weekly') { outputFileName = await weeklyExport(input) }
  else throw Error('No valid fulfilment type was found in input')

  if (outputFileName == null) {
    throw Error('Failed to upload fulfilement files')
  } else {
    return { ...input, fulfilmentFile: outputFileName }
  }
}
