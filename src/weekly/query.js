// @flow
import { fetchConfig } from './../lib/config'
import type { Config } from './../lib/config'
import { Zuora } from './../lib/Zuora'
import type { Query } from './../lib/Zuora'
import moment from 'moment'

type input = {
  deliveryDate: ?string,
  deliveryDayOfWeek: ?string,
  minDaysInAdvance: ?number
}

function getCutOffDate (deliveryDate: moment) {
  let today = moment().startOf('day')
  let daysUntilDelivery = deliveryDate.diff(today)
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
        Product.ProductType__c = 'Guardian Weekly' AND
        RatePlan.Name != 'Guardian Weekly 6 Issues' AND
        RatePlan.Name != 'Guardian Weekly 12 Issues' AND
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
      'name': 'WeeklyIntroductoryPeriods',
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
        RatePlanCharge
      WHERE 
       (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
         Product.ProductType__c = 'Guardian Weekly' AND
        ( RatePlan.Name = 'Guardian Weekly 6 Issues' OR RatePlan.Name = 'Guardian Weekly 12 Issues' ) AND
        ( RatePlan.AmendmentType IS NULL OR RatePlan.AmendmentType != 'RemoveProduct' ) AND
        RatePlanCharge.EffectiveStartDate <= '${formattedDeliveryDate}' AND
        RatePlanCharge.EffectiveEndDate > '${formattedDeliveryDate}' 
    `
    }
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
  let jobId = await zuora.query('Fulfilment-Queries', subsQuery, holidaySuspensionQuery, introductoryPeriodQuery)
  return {deliveryDate: formattedDeliveryDate, jobId: jobId}
}

let weekDays = new Map([
  ['SUNDAY', 0],
  ['MONDAY', 1],
  ['TUESDAY', 2],
  ['WEDNESDAY', 3],
  ['THURSDAY', 4],
  ['FRIDAY', 5],
  ['SATURDAY', 6],
  ['SUN', 0],
  ['MON', 1],
  ['TUE', 2],
  ['WED', 3],
  ['THU', 4],
  ['FRI', 5],
  ['SAT', 6]
])

export function getDeliveryDate (input: input) {
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

  if (input.deliveryDayOfWeek && typeof input.minDaysInAdvance === 'number') {
    let dayOfWeek = input.deliveryDayOfWeek.toUpperCase().trim()
    if (!weekDays.has(dayOfWeek)) {
      throw new Error(`${input.deliveryDayOfWeek} is not a valid day of the week`)
    }
    let dayOfWeekNum = weekDays.get(dayOfWeek)
    let minDaysInAdvance = input.minDaysInAdvance
    let minDate = moment().startOf('day').add(minDaysInAdvance, 'days')
    let dayInWeek = minDate.clone().weekday(dayOfWeekNum)

    if (dayInWeek.isBefore(minDate)) {
      return dayInWeek.add(7, 'days')
    } else {
      return dayInWeek
    }
  }
  throw new Error('deliveryDate or (deliveryDayOfWeek and minDaysInAdvance) input params must be provided')
}

export async function weeklyQuery (input: input) {
  let deliveryDate = getDeliveryDate(input)
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  return queryZuora(deliveryDate, config)
}
