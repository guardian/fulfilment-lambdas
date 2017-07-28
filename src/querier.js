import { fetchConfig } from './lib/config'
import {query, Zuora} from './lib/Zuora'
import moment from 'moment'

function queryZuora (deliveryDate, config) {
  const formattedDate = deliveryDate.format('YYYY-MM-DD')
  const deliveryDay = deliveryDate.format('dddd')
  const zuora = new Zuora(config)
  const subsQuery: query =
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
              SoldToContact.FirstName, 
              SoldToContact.LastName, 
              SoldToContact.PostalCode, 
              SoldToContact.State,
              SoldToContact.workPhone,
              Account.SpecialDeliveryInstructions__c
          FROM
            rateplancharge
          WHERE
           (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
           ProductRatePlanCharge.ProductType__c = 'Print ${deliveryDay}' AND
           Product.Name = 'Newspaper Delivery' AND
           RatePlanCharge.EffectiveStartDate <= '${formattedDate}' AND
           RatePlanCharge.EffectiveEndDate >= '${formattedDate}' AND
           (RatePlanCharge.MRR != 0 OR ProductRatePlan.FrontendId__c != 'EchoLegacy')`
    }
  const holidaySuspensionQuery: query =
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
  return zuora.query('Fulfilment-Queries', subsQuery, holidaySuspensionQuery)
}

export function handler (input, context, callback) {
  asyncHandler(input).then(res => callback(null, {...input, jobId: res.jobId, deliveryDate: res.deliveryDate}))
    .catch(error => callback(error))
}

function getDeliveryDate (input) {
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

  if (input.deliveryDateDaysFromNow) {
    return moment().add(input.deliveryDateDaysFromNow, 'days')
  }
  throw new Error('deliveryDate or deliveryDateDaysFromNow input param must be provided')
}

async function asyncHandler (input) {
  let deliveryDate = getDeliveryDate(input)
  let config = await fetchConfig()
  console.log('Config fetched succesfully.')
  return queryZuora(deliveryDate, config.zuora.api)
}
