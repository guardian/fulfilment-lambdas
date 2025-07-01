import { fetchConfig } from '../lib/config';
import type { Config } from '../lib/config';
import { Zuora } from '../lib/Zuora';
import type { Query } from '../lib/Zuora';
import { buildHolidayCreditQuery } from '../lib/HolidayCreditQuery';
import moment, { Moment } from 'moment';
import { getDeliveryDate } from './WeeklyInput';
import type { WeeklyInput } from './WeeklyInput';

/**
 * Date to compare termEndDate with to decide whether sub should be fulfilled.
 *
 * @param deliveryDate Issue date of publication
 * @returns {*|moment} Comparison date
 */
function getCutOffDate(deliveryDate: Moment) {
	const today = moment().startOf('day');
	const daysUntilDelivery = deliveryDate.diff(today);
	if (daysUntilDelivery <= 0) {
		return deliveryDate;
	}
	/*
	 * We give a grace period so that
	 * the next issue after cancellation is fulfilled
	 * if the cancellation falls between two issues.
	 */
	return deliveryDate.subtract(6, 'days');
}

async function queryZuora(deliveryDate: Moment, config: Config) {
	const formattedDeliveryDate = deliveryDate.format('YYYY-MM-DD');
	const cutOffDate = getCutOffDate(deliveryDate).format('YYYY-MM-DD');
	const zuora = new Zuora(config);

	const subsQuery: Query = {
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
        RatePlanCharge
      WHERE 
        ProductRatePlanCharge.ProductType__c = 'Guardian Weekly' AND
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
            EffectiveStartDate <= '${formattedDeliveryDate}' AND
            EffectiveEndDate > '${formattedDeliveryDate}'
            ) OR 
           (
            RatePlan.AmendmentType = 'NewProduct' AND 
            EffectiveStartDate <= '${formattedDeliveryDate}'
           )
        ) AND
        IsLastSegment = true AND
        Subscription.ContractAcceptanceDate <= '${formattedDeliveryDate}' AND
        (
          (
             Subscription.AutoRenew = true AND
             Subscription.Status = 'Active'   
          ) OR
          (
            Subscription.Status = 'Cancelled' AND
            (Subscription.ReaderType__c != 'Gift' OR Subscription.ReaderType__c IS NULL) AND
            Subscription.TermEndDate >= '${cutOffDate}'
          ) OR
          (
            Subscription.Status = 'Cancelled' AND
            Subscription.ReaderType__c = 'Gift' AND
            Subscription.TermEndDate >= '${formattedDeliveryDate}'
          ) OR
          (
           Subscription.Status = 'Active' AND  
           Subscription.AutoRenew = false AND
           Subscription.TermEndDate >= '${cutOffDate}'
          )
        )
    `,
	};
	const introductoryPeriodQuery: Query = {
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
    `,
	};
	const holidaySuspensionQuery: Query = {
		name: 'WeeklyHolidaySuspensions',
		query: buildHolidayCreditQuery(formattedDeliveryDate),
	};
	const jobId = await zuora.query(
		'Fulfilment-Queries',
		subsQuery,
		holidaySuspensionQuery,
		introductoryPeriodQuery,
	);
	return { deliveryDate: formattedDeliveryDate, jobId: jobId };
}

export async function weeklyQuery(input: WeeklyInput) {
	const deliveryDate = getDeliveryDate(input);
	const config = await fetchConfig();
	console.log('Config fetched succesfully.');
	return queryZuora(deliveryDate, config);
}
