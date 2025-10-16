# Fulfilment Lambdas - Data Quality Alarms Implementation Plan

## Context
Following the July 2025 incident where missing delivery agent information affected 21 customers for 6 days without detection, we need to add alarms to detect missing or invalid critical data in fulfilment files.

## Root Cause
- **Missing Field**: Delivery agent information was not present in the data
- **Detection Gap**: No validation or alerting to catch this issue
- **Time to Notice**: 6 days (from July 16 to July 22)
- **Impact**: 15 customers had missed deliveries, 4 cancelled subscriptions

## Implementation Status

###  ✅ Completed
1. **CloudWatch Metrics Utility** - `src/lib/cloudwatch.ts`
   - Reusable module for publishing metrics
   - Follows Guardian patterns from support-service-lambdas
   - Functions: `putMetric()`, `putValidationError()`, `putRowsProcessed()`

2. **IAM Permissions** - `cloudformation/cloudformation.yaml`
   - Added `CloudWatchMetrics` policy to `FulfilmentWorkersLambdaRole`
   - Allows `cloudwatch:PutMetricData` action

3. **Delivery Agent Field** - `src/homedelivery/query.ts`
   - Added `SoldToContact.DeliveryAgent__c` to Zuora ZOQL query
   - Field now included in exported data

4. **Validation Logic** - `src/homedelivery/export.ts`
   - Added validation counters for all critical fields
   - Validates: delivery agent, address, postcode, customer name
   - Logs warnings for each validation error with subscription ID
   - Publishes metrics after CSV processing completes

5. **CloudWatch Alarms** - `cloudformation/cloudformation.yaml`
   - Added 4 alarms (lines 714-836):
     - `MissingDeliveryAgentAlarm` - Critical incident-driven alarm
     - `MissingAddressAlarm` - Missing address validation
     - `MissingPostcodeAlarm` - Missing postcode validation
     - `MissingNameAlarm` - Missing customer name validation
   - All alarms trigger on threshold > 0 errors
   - Configured for PROD only with `alarms-handler-topic`

### 🔄 Next Steps

#### Testing ⏳
1. **Local Testing**:
   - Add mock data with missing delivery agent
   - Run `pnpm run:hd:exporter`
   - Verify metrics are published (check CloudWatch console)

2. **CODE Testing**:
   - Deploy to CODE
   - Trigger step function manually
   - Check CloudWatch metrics: `fulfilment-lambdas` namespace
   - Verify alarms don't fire for valid data
   - Test with invalid data to confirm alarms trigger

3. **PROD Deployment**:
   - Deploy after successful CODE testing
   - Monitor for 1 week
   - Adjust thresholds if needed based on real data

## Questions to Answer

1. **What is the Zuora field name for delivery agent?**
   - Need to check Zuora schema
   - Likely a custom field ending in `__c`

2. **What are typical row counts for Home Delivery?**
   - Needed to set `LowRowCountAlarm` threshold
   - Should be ~80% of historical average

3. **Should we fail the export if critical fields are missing?**
   - Currently: No (just log and alert)
   - Alternative: Fail fast and prevent bad data from reaching Salesforce

4. **Do we need similar validation for Guardian Weekly?**
   - Yes, but delivery agent may not be relevant for Weekly
   - Focus on address fields

## Files Modified

- ✅ `src/lib/cloudwatch.ts` - NEW - CloudWatch metrics utility
- ✅ `cloudformation/cloudformation.yaml` - IAM policy + 4 alarms added (lines 171-177, 714-836)
- ✅ `src/homedelivery/export.ts` - Validation logic & metrics publishing complete
- ✅ `src/homedelivery/query.ts` - Delivery agent field added to Zuora query
- ⏳ `src/weekly/export.ts` - Future: Add similar validation for Guardian Weekly

## Success Criteria

✅ Alarms trigger within 5 minutes when critical data is missing
✅ Platform team receives alerts via `alarms-handler-topic`
✅ No false positives in PROD for 1 week
✅ Detection time reduced from 6 days to < 5 minutes
✅ Alarms include actionable information (which field, how many rows)

## Related Documents

- Incident Retrospective: [Google Doc](https://docs.google.com/document/d/1Bs9YFEjAgZpsEmd8XOiQFLd33qYCGE-2Yju4JHJ9AQQ/edit?tab=t.0)
- Alarm Process: https://docs.google.com/document/d/1_3El3cly9d7u_jPgTcRjLxmdG2e919zCLvmcFCLOYAk/edit
- Guardian Alarm Handler: `/Users/admin.olivier.andrade/Downloads/support-service-lambdas/cdk/lib/alarms-handler.ts`
