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
  const generateFulfilmentFiles = async (type) => {
    if (type === 'homedelivery') {
      return homedeliveryExport(input)
    } else if (type === 'weekly') {
      return weeklyExport(input)
    } else throw Error('No valid fulfilment type was found in input')
  }
  const outputFileName = await generateFulfilmentFiles(input.type)
  if (outputFileName) {
    return { ...input, fulfilmentFile: outputFileName }
  } else {
    throw Error('Failed to upload fulfilement files')
  }
}
