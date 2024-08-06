import { fetchConfig } from '../lib/config';
import type { Config } from '../lib/config';
import { Zuora } from '../lib/Zuora';
import type { Query } from '../lib/Zuora';
import { buildHolidayCreditQuery } from '../lib/HolidayCreditQuery';
import moment, { Moment } from 'moment';
import type { Input } from '../querier';

async function queryZuora(deliveryDate: Moment, config: Config) {
	const formattedDate = deliveryDate.format('YYYY-MM-DD');
	const deliveryDay = deliveryDate.format('dddd');
	const zuora = new Zuora(config);
	const currentDate = moment().format('YYYY-MM-DD');
	const subsQuery: Query = {
		name: 'Subscriptions',
		query: `
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
      RatePlanCharge.EffectiveEndDate > '${formattedDate}' OR
      ( 
        RatePlanCharge.EffectiveEndDate >= '${currentDate}' AND
        Subscription.Status = 'Active' AND Subscription.AutoRenew = true AND 
        ( RatePlan.AmendmentType IS NULL OR RatePlan.AmendmentType != 'RemoveProduct' )
      )
     ) 
     AND
     (RatePlanCharge.MRR != 0 OR ProductRatePlan.FrontendId__c != 'EchoLegacy')`,
	};
	/*
    if the charge ends on or after the fulfilment date, it's a standard case so fulfil with no problem.

    alternatively, if it ends on or after today it may be auto renewed by zuora before the fulfilment date.
    We need to predict whether zuora will auto renew based on the fields we have available.
    At present we predict based on the fields checked below the OR statement above, however this may be refined in future.
  */

	const holidaySuspensionQuery: Query = {
		name: 'HolidaySuspensions',
		query: buildHolidayCreditQuery(formattedDate),
	};
	const jobId = await zuora.query(
		'Fulfilment-Queries',
		subsQuery,
		holidaySuspensionQuery,
	);
	return { deliveryDate: formattedDate, jobId: jobId };
}

function getDeliveryDate(input: Input) {
	if (input.deliveryDate) {
		const deliveryDate = moment(input.deliveryDate, 'YYYY-MM-DD');
		if (!deliveryDate.isValid()) {
			throw new Error('deliveryDate must be in the format "YYYY-MM-DD"');
		} else {
			console.log(deliveryDate);
			console.log('is valid');
		}
		return deliveryDate;
	}

	if (
		input.deliveryDateDaysFromNow ||
		typeof input.deliveryDateDaysFromNow === 'number'
	) {
		const deliveryDateDaysFromNow = input.deliveryDateDaysFromNow;
		return moment().add(deliveryDateDaysFromNow, 'days');
	}
	throw new Error(
		'deliveryDate or deliveryDateDaysFromNow input param must be provided',
	);
}

export async function homedeliveryQuery(input: Input) {
	const deliveryDate = getDeliveryDate(input);
	const config = await fetchConfig();
	console.log('Config fetched succesfully.');
	console.log('Input: ', input);
	return queryZuora(deliveryDate, config);
}
