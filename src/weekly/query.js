// @flow
import { fetchConfig } from './../lib/config'
import type { Config } from './../lib/config'
import { Zuora } from './../lib/Zuora'
import type { Query } from './../lib/Zuora'
import moment from 'moment'
import { getDeliveryDate } from './WeeklyInput'
import type { WeeklyInput } from './WeeklyInput'
function getCutOffDate (deliveryDate: moment) {
  const today = moment().startOf('day')
  const daysUntilDelivery = deliveryDate.diff(today)
  if (daysUntilDelivery <= 0) {
    return deliveryDate
  }
  // TODO this code just replicates what the sf fulfilment does to minimize the differences, maybe we could change it later to just use the daysUntilDelivery
  if (daysUntilDelivery <= 6) {
    return deliveryDate.subtract(6, 'days')
  } else {
    return deliveryDate.subtract(13, 'days')
  }
}

async function queryZuora (deliveryDate, config: Config) {
  const formattedDeliveryDate = deliveryDate.format('YYYY-MM-DD')
  const cutOffDate = getCutOffDate(deliveryDate).format('YYYY-MM-DD')
  const zuora = new Zuora(config)

  const subsQuery: Query =
    {
      name: 'WeeklySubscriptions',
      query: `
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
        Product.ProductType__c = 'Guardian Weekly' AND
        RatePlan.Name != 'Guardian Weekly 6 Issues' AND
        RatePlan.Name != 'Guardian Weekly 12 Issues' AND
        RatePlan.Name != 'GW Oct 18 - Six for Six - ROW' AND
        RatePlan.Name != 'GW Oct 18 - Six for Six - Domestic' AND
        (
          RatePlan.AmendmentType IS NULL OR
          (
            RatePlan.AmendmentType != 'RemoveProduct' AND 
            RatePlan.AmendmentType != 'NewProduct' 
           ) OR
          (
            RatePlan.AmendmentType = 'RemoveProduct' AND 
            Amendment.EffectiveDate > '${formattedDeliveryDate}' 
            ) OR 
           (
            RatePlan.AmendmentType = 'NewProduct' AND 
            Amendment.CustomerAcceptanceDate <= '${formattedDeliveryDate}' 
           )
        ) AND
        Subscription.ContractAcceptanceDate <= '${formattedDeliveryDate}' AND
        (
          (
             Subscription.AutoRenew = true AND
             Subscription.Status = 'Active'   
          ) OR
          (
            Subscription.Status = 'Cancelled' AND
            Subscription.TermEndDate >= '${cutOffDate}'
          ) OR
          (
           Subscription.Status = 'Active' AND  
           Subscription.AutoRenew = false AND
           Subscription.TermEndDate >= '${cutOffDate}'
          )
        )
    `
    }
  const introductoryPeriodQuery: Query =
    {
      name: 'WeeklyIntroductoryPeriods',
      query: `
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
        RatePlanCharge
      WHERE 
       (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
         Product.ProductType__c = 'Guardian Weekly' AND
        ( RatePlan.Name = 'Guardian Weekly 6 Issues' OR RatePlan.Name = 'Guardian Weekly 12 Issues' OR RatePlan.Name = 'GW Oct 18 - Six for Six - ROW' OR RatePlan.Name = 'GW Oct 18 - Six for Six - Domestic' ) AND
        ( RatePlan.AmendmentType IS NULL OR RatePlan.AmendmentType != 'RemoveProduct' ) AND
        RatePlanCharge.EffectiveStartDate <= '${formattedDeliveryDate}' AND
        RatePlanCharge.EffectiveEndDate > '${formattedDeliveryDate}' 
    `
    }
  const holidaySuspensionQuery: Query =
    {
      name: 'WeeklyHolidaySuspensions',
      query: `
      SELECT
        Subscription.Name
      FROM
        rateplancharge
      WHERE
       (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
       ProductRatePlanCharge.ProductType__c = 'Adjustment' AND
       RateplanCharge.Name = 'Holiday Credit' AND
       RatePlanCharge.HolidayStart__c <= '${formattedDeliveryDate}' AND
       RatePlanCharge.HolidayEnd__c >= '${formattedDeliveryDate}' AND
       RatePlan.AmendmentType != 'RemoveProduct'`
    }
  const jobId = await zuora.query('Fulfilment-Queries', subsQuery, holidaySuspensionQuery, introductoryPeriodQuery)
  return { deliveryDate: formattedDeliveryDate, jobId: jobId }
}

export async function weeklyQuery (input: WeeklyInput) {
  const deliveryDate = getDeliveryDate(input)
  const config = await fetchConfig()
  console.log('Config fetched succesfully.')
  return queryZuora(deliveryDate, config)
}
