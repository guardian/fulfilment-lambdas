import {fetchConfig} from './lib/config'
import request from 'request'
import moment from 'moment'

function queryZuora (deliveryDate, config) {
  let promise = new Promise((resolve, reject) => {
    const deliveryDay = moment(deliveryDate, 'YYYY-MM-DD').format('dddd')
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
           RatePlanCharge.EffectiveStartDate <= '${deliveryDate}' AND
           RatePlanCharge.EffectiveEndDate >= '${deliveryDate}' AND
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
       RatePlanCharge.EffectiveStartDate <= '${deliveryDate}' AND
       RatePlanCharge.HolidayEnd__c >= '${deliveryDate}' AND
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
      console.log('body:', body)
      if (response.statusCode !== 200) {
        reject(new Error(`error response status ${response.statusCode}`))
      } else if (body.errorCode) {
        reject(new Error(`zuora error! code: ${body.errorCode} : ${body.message}`))
      } else {
        resolve(body.id)
      }
    })
  })
  return promise
}

export function handler (input, context, callback) {
  fetchConfig()
  .then(config => queryZuora(input.deliveryDate, config.zuora.api))
  .then(jobId => callback(null, {'jobId': jobId, 'deliveryDate': input.deliveryDate}))
  .catch(error => callback(error))
}
