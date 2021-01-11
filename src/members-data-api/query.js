// @flow
import { fetchConfig } from './../lib/config'
import type { Config } from './../lib/config'
import { Zuora } from './../lib/Zuora'
import type { Query } from './../lib/Zuora'
import moment from 'moment'
import type { Input } from '../querier'
import { ZuoraNames, QUERY_NAME } from './names';

async function queryZuora (config: Config) {
  const zuora = new Zuora(config)
  const currentDate = moment().format('YYYY-MM-DD')
  const subsQuery: Query =
    {
      name: QUERY_NAME,
      query: `
      SELECT
      ${ZuoraNames.identityId},
      ${ZuoraNames.ratePlanName},
      ${ZuoraNames.ratePlanChargeName},
      ${ZuoraNames.termEndDate}
    FROM
      rateplancharge
    WHERE
     Subscription.Status = 'Active' AND
     ${ZuoraNames.termEndDate} >= '${currentDate}'
     `
    }

  const jobId = await zuora.query('Fulfilment-Queries', subsQuery)
  return { deliveryDate: currentDate, jobId: jobId }
}

export async function membersDataApiQuery (input: Input) {
  const config = await fetchConfig()
  console.log('Config fetched succesfully.')
  console.log('Input: ', input)
  return queryZuora(config)
}
