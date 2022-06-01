# fulfilment-lambdas

**Fulfilment** refers to the process of delivering physical paper to subscribers. Fulfilment files are CSVs with the 
following columns

**Guardian Weekly**

```
      1 "Subscriber ID"
      2 "Name"
      3 "Company name"
      4 "Address 1"
      5 "Address 2"
      6 "Address  3"
      7 "Country"
      8 "Post code"
      9 "Copies"
```

**Home Delivery**

```
      1 "Customer Reference"
      2 "Contract ID"
      3 "Customer Full Name"
      4 "Customer Job Title"
      5 "Customer Company"
      6 "Customer Department"
      7 "Customer Address Line 1"
      8 "Customer Address Line 2"
      9 "Customer Address Line 3"
     10 "Customer Town"
     11 "Customer PostCode"
     12 "Delivery Quantity"
     13 "Customer Telephone"
     14 "Property type"
     15 "Front Door Access"
     16 "Door Colour"
     17 "House Details"
     18 "Where to Leave"
     19 "Landmarks"
     20 "Additional Information"
     21 "Letterbox"
     22 "Source campaign"
     23 "Sent Date"
     24 "Delivery Date"
     25 "Returned Date"
     26 "Delivery problem"
     27 "Delivery problem notes"
     28 "Charge day"
```

The fulfilment files are generated on a schedule from Zuora by an AWS stack and then uploaded to Salesforce Documents.

![image](https://user-images.githubusercontent.com/13835317/72618036-27606c00-3932-11ea-8beb-4837f30f64b5.png)

## Fallback mechanism

Fulfilment files are generated every day not only for the next delivery date, but also for further dates in advance. 
This way if Zuora fails to export data, then we still have a fulfilment file to fallback on although it might be few
days out-of-date.   

## Generation schedule

The specific rules will vary depending on the particular product and target day of delivery (see sections below) but in 
general each fulfilment file will be first generated and replaced daily with an updated version until the final version 
is uploaded.

### Home Delivery Schedule

Home Delivery files will be generated Monday to Friday at 7:30 GMT (see [cloudwatch rule](https://eu-west-1.console.aws.amazon.com/events/home?region=eu-west-1#/eventbus/default/rules/fulfilment-lambdas-PROD-ScheduledRule-CBXIT5CNIZ8C))
Each time 5 files will be generated for 1, 2, 3, 4 and 5 days into the future.

Upload to salesforce is triggered manually by calling our [fulfilment api](https://github.com/guardian/fulfilment-lambdas/blob/main/cloudformation/cloudformation.yaml#L355) from a salesforce UI that allows to download one or multiple files.
 In most cases a file is uploaded to salesforce the day before delivery. Exceptions to this are fridays when files are uploaded for the next 3 days, and bank holidays.

### Guardian Weekly Schedule

Guardian Weekly files are generated every day at 2:00 GMT (see [cloudwatch rule](https://eu-west-1.console.aws.amazon.com/events/home?region=eu-west-1#/eventbus/default/rules/fulfilment-lambdas-PROD-WeeklyScheduledRule-1QIVLQ8W0XG6M)). Each time a set of fulfilment files for all regions is generated for the next Friday that is at least 8 days away.
This guarantees that we only generate files that have not been uploaded to salesforce yet.

Guardian Weekly files will be automatically uploaded to salesforce every Thursday at 11:00 GMT (see [cloudwatch rule](https://eu-west-1.console.aws.amazon.com/events/home?region=eu-west-1#/eventbus/default/rules/fulfilment-lambdas-PROD-WeeklyScheduledUploadRule-NRHNG387CPKL)). Files are uploaded a week in advance, so each Thursday the uploaded files are not the ones used for delivery the next day but the Friday on the following week.

## Testing in CODE
1. Deploy your branch to CODE using riffraff
1. Go to the step functions section in AWS
1. Copy the input from one of the existing e.g.
```json
{
  "deliveryDateDaysFromNow": 5,
  "type": "homedelivery"
}
```
or
```json
{
  "type": "weekly",
  "deliveryDayOfWeek": "friday",
  "minDaysInAdvance": 8
}
```
1. create a new execution and call it what you like, and pass in the json
1. wait for it to finish
1. check that the fulfilment files appeared in S3 fulfilment-export-code/fulfilment_output

## Skipping TeamCity for quicker development feedback loop in CODE

1. Set `"uploadArtefact": false,` at the root of `package.json` which disables automatic upload of the zipped artefact
1. Simulate TC build by creating yarn script which
    ```
    "mario": "yarn install && yarn check && yarn flow && yarn compile && yarn dist && yarn riffraff"
    ```
1. Execute with `yarn mario`
1. Artefact is created under `fulfilment-lambdas/target/riffraff/fulfilment-lambdas/fulfilment-lambdas.zip`
1. Manually upload lambda function code to CODE via AWS Console
1. Run step function
1. Check S3 bucket


## Validating deployment to PROD

1. Best to do it on Friday after Guardian Weekly was uploaded on Thursday, and Home Delivery was uploaded on Friday for 
the next three days in advance.
1. Backup current fulfilment files in AWS
    ```
    aws s3 sync s3://fulfilment-export-prod . --profile membership
    ```
1. Deploy branch to PROD
1. Cloudform if necessary
1. Run GW step function
    ```json
    {
      "type": "weekly",
      "deliveryDayOfWeek": "friday",
      "minDaysInAdvance": 8
    }
    ```
1. Run HD step funcion
    ```json
    {
      "deliveryDateDaysFromNow": 1,
      "type": "homedelivery"
    }
    ```
1. Download a GW fulfilment file for next week after step function completed
1. Download HD file for next day after step function completed
1. Diff the files with corresponding ones from backup
1. Merge to PROD

Revert
1. Rollback to old template if necessary
1. Deploy current main branch
1. Re-run stepfunctions
1. Check files against backup

## Glossary

|System           |Name                                    |Description                                                                                |
|-----------------|----------------------------------------|------------------------------------------------------------------------------------------ |
|AWS Step         |QueryZuora                              |`querier.js`                                                                               |
|AWS Step         |FetchResults                            |`fetcher.js`                                                                               |
|AWS Step         |GenerateFulfilmentFiles                 |`exporter.js`                                                                              |
|AWS Lambda       |salesforce_uploader                     |`salesforce_uploader.js` uploads Home Delivery; behind fulfilment-api                      |
|AWS Lambda       |weekly-fulfilmentUploader               |`/weekly/salesforce_uploader.js` uploads Guardian Weekly; triggered on a schedule          |
|AWS S3           |zuoraExport                             |Raw zuora CSV export (https://www.zuora.com/apps/BatchQuery.do)                            |
|AWS S3           |zuoraExport/Subscriptions_*             |Home Delivery raw export                                                                   |
|AWS S3           |zuoraExport/HolidaySuspensions_*        |Home Delivery holiday suspension                                                           |
|AWS S3           |zuoraExport/WeeklyIntroductoryPeriods_* |Guardian Weekly 6-for-6 subscriptions raw                                                  |
|AWS S3           |zuoraExport/WeeklySubscriptions_*       |Guardian Weekly regular subscriptions raw                                                  |
|AWS S3           |zuoraExport/WeeklyHolidaySuspensions_*  |Guardian Weekly holiday suspensions raw                                                    |
|AWS S3           |fulfilments                             |Guardian Weekly clean with holidays filtered out                                           |
|AWS S3           |fulfilment_output                       |Home Delivery clean with holidays filtered out                                             |
|AWS S3           |uploaded                                |Home Delivery manually uploaded files to SF                                                |
|AWS API          |fulfilment-api                          |API hit by SF to manually trigger upload of Home Delivery via `salesforce_uploader.js`     |
|SF Documents     |Home_Delivery_Pipeline_Fulfilment       |Folder where Home Delivery CSV is manually uploaded via 'Home Delivery Reports' page       |
|SF Documents     |Guardian Weekly (REGION)                |Folder where Guardian weekly CSV is automatically uploaded on a schedule                   |
|SF Documents     |weekly_sample_files                     |(UAT only) Folder where Guardian weekly CSV is automatically uploaded on a schedule        |
|SF Page          |Home Delivery Reports                   |Page where CSR can manually trigger upload of Home Delivery CSV                            |
|SF User          |Fulfilment User API                     |Credentials for upload to SF are in gu-reader-revenue-private/membership/fulfilment-lambdas|

## Cloudforming 

FIXME: Is this still necessary?

Because of limitations in cloudformation templates we need an additional step to update the stacks :
1. Make the required changes in [cloudformation/cloudformation.yaml](https://github.com/guardian/fulfilment-lambdas/blob/main/cloudformation/cloudformation.yaml)
2. Run 'yarn cloudform'. Stage specific versions of the cloudformation template will be generated
3. Use the generated version for the desired stage to update the stack (it will be in cloudformation/[stage].yaml)

## Running Locally

FIXME: Is this still working?

Each lambda can be run locally using the appropriate `yarn run:` command. This uses [lambda-local](https://github.com/ashiina/lambda-local) to emulate the AWS environment. 
_Note: A specific build is referenced in package.json as there is a bug in lambda-local regarding aws credentials that hasn't been fixed in the main branch_

To install dependencies for running locally:
```bash
yarn install 
yarn dist
```
And to transpile the lambdas:
```bash
yarn compile
```
This will transpile any ES6/7 into javascript which will run on the Node environment of AWS.
