// @flow
import { fetchConfig } from './../lib/config'
import type {Config} from './../lib/config'
import {Zuora} from './../lib/Zuora'
import type {Query} from './../lib/Zuora'
import moment from 'moment'

type input = {
  deliveryDate: ?string,
  deliveryDateDaysFromNow: ?number
}
async function queryZuora (deliveryDate, config: Config) {
  const formattedDeliveryDate = deliveryDate.format('YYYY-MM-DD')
  const aWeekBeforeDelivery = deliveryDate.subtract(7, 'days').format('YYYY-MM-DD')
  const zuora = new Zuora(config)

  const subsQuery: Query =
    {
      'name': 'WeeklySubscriptions',
      'query': `
      SELECT
      Subscription.Name,
      SoldToContact.Address1,
      SoldToContact.Address2,
      SoldToContact.City,
      SoldToContact.Company_Name__c,
      SoldToContact.Country,
      SoldToContact.Title__c,
      SoldToContact.FirstName,
      SoldToContact.LastName,
      SoldToContact.PostalCode,
      SoldToContact.State,
      Subscription.CanadaHandDelivery__c
      FROM
        rateplan
      WHERE 
        ( Subscription.Status = 'Active' OR 
          Subscription.Status = 'Cancelled'
        ) AND
        Product.ProductType__c = 'Guardian Weekly' AND
        (
          RatePlan.AmendmentType IS NULL OR 
          RatePlan.AmendmentType != 'RemoveProduct'
        ) AND
        Subscription.ContractAcceptanceDate <= '${formattedDeliveryDate}' AND
        (
          (
             Subscription.AutoRenew = true AND
             Subscription.Status = 'Active'   
          ) OR
          (
            Subscription.Status = 'Cancelled' AND
            Subscription.TermEndDate >= '${aWeekBeforeDelivery}'
          ) OR
          (
           Subscription.Status = 'Active' AND  
           Subscription.AutoRenew = false AND
           Subscription.TermEndDate >= '${aWeekBeforeDelivery}'
          )
        )
    `}

  const holidaySuspensionQuery: Query =
    {
      'name': 'WeeklyHolidaySuspensions',
      'query': `
      SELECT
        Subscription.Name
      FROM
        rateplancharge
      WHERE
       (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
       ProductRatePlanCharge.ProductType__c = 'Adjustment' AND
       RateplanCharge.Name = 'Holiday Credit' AND
       RatePlanCharge.EffectiveStartDate <= '${formattedDeliveryDate}' AND
       RatePlanCharge.HolidayEnd__c >= '${formattedDeliveryDate}' AND
       RatePlan.AmendmentType != 'RemoveProduct'`
    }
  let jobId = await zuora.query('Fulfilment-Queries', subsQuery, holidaySuspensionQuery)
  return {deliveryDate: formattedDeliveryDate, jobId: jobId}
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

export async function weeklyQuery (input: input) {
  let deliveryDate = getDeliveryDate(input)
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  return queryZuora(deliveryDate, config)
}
