export function buildHolidayCreditQuery(formattedDeliveryDate) {
	return `
      SELECT
        Subscription.Name
      FROM
        RatePlanCharge
      WHERE
       (Subscription.Status = 'Active' OR Subscription.Status = 'Cancelled') AND
       ProductRatePlanCharge.ProductType__c = 'Adjustment' AND
       RatePlanCharge.Name = 'Holiday Credit' AND
       RatePlanCharge.HolidayStart__c <= '${formattedDeliveryDate}' AND
       RatePlanCharge.HolidayEnd__c >= '${formattedDeliveryDate}' AND
       RatePlan.AmendmentType != 'RemoveProduct'`;
}
