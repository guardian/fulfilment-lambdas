import { fetchConfig } from './lib/config'
import request from 'request'
import moment from 'moment'

function queryZuora (deliveryDate, config) {
  let promise = new Promise((resolve, reject) => {
    let formattedDate = deliveryDate.format('YYYY-MM-DD')
    const deliveryDay = deliveryDate.format('dddd')
    const subsQuery = `
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

    const holidaySuspensionQuery = `
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

    const options = {
      method: 'POST',
      uri: `${config.url}/apps/api/batch-query/`,
      json: true,
      body: {
        'format': 'csv',
        'version': '1.0',
        'name': 'Fulfilment-Queries',
        'encrypted': 'none',
        'useQueryLabels': 'true',
        'dateTimeUtc': 'true',
        'queries': [
          {
            'name': 'Subscriptions',
            'query': subsQuery,
            'type': 'zoqlexport'
          },
          {
            'name': 'HolidaySuspensions',
            'query': holidaySuspensionQuery,
            'type': 'zoqlexport'
          }
        ]
      },
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64'),
        'Content-Type': 'application/json'
      }
    }

    request(options, function (error, response, body) {
      if (error) {
        reject(error)
        return
      }

      console.log('statusCode:', response && response.statusCode)

      if (response.statusCode !== 200) {
        reject(new Error(`error response status ${response.statusCode}`))
      } else if (body.errorCode) {
        reject(new Error(`zuora error! code: ${body.errorCode} : ${body.message}`))
      } else {
        resolve({
          deliveryDate: formattedDate,
          jobId: body.id
        })
      }
    })
  })
  return promise
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
