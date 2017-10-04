// @flow
import { fetchConfig } from './../lib/config'
import type {Config} from './../lib/config'
import {Zuora} from './../lib/Zuora'
import type {Query} from './../lib/Zuora'
import moment from 'moment'
import type { input } from '../querier'

async function queryZuora (deliveryDate, config: Config) {
  const formattedDate = deliveryDate.format('YYYY-MM-DD')
  const deliveryDay = deliveryDate.format('dddd')
  const zuora = new Zuora(config)
  const currentDate = moment().format('YYYY-MM-DD')
  const subsQuery: Query =
    {
      'name': 'Subscriptions',
      'query': `
      SELECT
      RateplanCharge.quantity,
      Subscription.Name,
        SoldToContact.Address1,
        SoldToContact.Address2,
        SoldToContact.City,
        SoldToContact.Country,
        SoldToContact.Title__c,
        SoldToContact.FirstName,
        SoldToContact.LastName,
        SoldToContact.PostalCode,
        SoldToContact.State,
        SoldToContact.workPhone,
        SoldToContact.SpecialDeliveryInstructions__c
    FROM
      rateplancharge
    WHERE
     (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
     ProductRatePlanCharge.ProductType__c = 'Print ${deliveryDay}' AND
     Product.Name = 'Newspaper Delivery' AND
     RatePlanCharge.EffectiveStartDate <= '${formattedDate}' AND
     (
      ( 
        Subscription.Status = 'Active' AND Subscription.AutoRenew = true AND RatePlanCharge.EffectiveStartDate >= '${currentDate}' AND RatePlanCharge.EffectiveEndDate >= '${currentDate}'
      )
      OR
      (
        Subscription.Status = 'Active' AND RatePlanCharge.EffectiveEndDate >= '${formattedDate}'
      )
      OR
      ( 
        Subscription.Status = 'Cancelled' AND RatePlanCharge.EffectiveEndDate > '${formattedDate}' 
      )
     ) 
     AND
     (RatePlanCharge.MRR != 0 OR ProductRatePlan.FrontendId__c != 'EchoLegacy')`
    } // NB to avoid case where subscription gets auto renewed after fulfilment time
  const holidaySuspensionQuery: Query =
    {
      'name': 'HolidaySuspensions',
      'query': `
      SELECT
      Subscription.Name
    FROM
      rateplancharge
    WHERE
     (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
     ProductRatePlanCharge.ProductType__c = 'Adjustment' AND
     RateplanCharge.Name = 'Holiday Credit' AND
     RatePlanCharge.EffectiveStartDate <= '${formattedDate}' AND
     RatePlanCharge.HolidayEnd__c >= '${formattedDate}' AND
     RatePlan.AmendmentType != 'RemoveProduct'`
    }
  let jobId = await zuora.query('Fulfilment-Queries', subsQuery, holidaySuspensionQuery)
  return {deliveryDate: formattedDate, jobId: jobId}
}

function getDeliveryDate (input: input) {
  if (input.deliveryDate) {
    let deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD')
    if (!deliveryDate.isValid()) {
      throw new Error('deliveryDate must be in the format "YYYY-MM-DD"')
    } else {
      console.log(deliveryDate)
      console.log('is valid')
    }
    return deliveryDate
  }

  if (input.deliveryDateDaysFromNow || typeof input.deliveryDateDaysFromNow === 'number') {
    let deliveryDateDaysFromNow = input.deliveryDateDaysFromNow
    return moment().add(deliveryDateDaysFromNow, 'days')
  }
  throw new Error('deliveryDate or deliveryDateDaysFromNow input param must be provided')
}

export async function homedeliveryQuery (input: input) {
  let deliveryDate = getDeliveryDate(input)
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  return queryZuora(deliveryDate, config)
}
