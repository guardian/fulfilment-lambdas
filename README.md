# fulfilment-lambdas
This project generates newspaper fulfilment files for the Home Delivery and Guardian Weekly products, currently sold [here](https://subscribe.theguardian.com).

The file generation process is written as [AWS Step Functions](https://aws.amazon.com/step-functions/), which query the subscription data in Zuora and construct files based on the results.

These files are uploaded to Salesforce, so that various distributors can download them. The upload process is carried out via a separate lambda (salesforce_uploader), and is triggered by a scheduled CloudWatch event (i.e. it is not part of the Step Functions).

There are various other lambdas in the project for file comparison and correctness checking. These are also currently triggered by scheduled CloudWatch events.

All lambdas in this project are built in ES6, using [StandardJS](https://standardjs.com) and [Flow](http://flow.org).

## Generation schedule

The specific rules will vary dependending on the type of fulfiment and target day of delivery (see sections below) but in 
general each fulfilment file will be first generated around a week before it's uploaded to salesforce and replaced daily with an updated version until the final version is uploaded.

The idea behind this is that if the fulfilment process fails on the day we need to upload a file we can still fall back on the file generated the day before. This fallback file will be valid but based on old data so It will not reflect changes made in the last 24 hours.

### Home Delivery Schedule

Home Delivery files will be generated Monday to Friday at 7:30 GMT (see [cloudwatch rule](https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#rules:name=fulfilment-lambdas-PROD-ScheduledRule-CBXIT5CNIZ8C))
Each time 5 files will be generated for 1, 2, 3, 4 and 5 days into the future.

Upload to salesforce is triggered manually by calling our [fulfilment api](https://github.com/guardian/fulfilment-lambdas/blob/master/cloudformation/cloudformation.yaml#L355) from a salesforce UI that allows to download one or multiple files.
 In most cases a file is uploaded to salesforce the day before delivery. Exceptions to this are fridays when files are uploaded for the next 3 days, and bank holidays.

### Guardian Weekly Schedule

Guardian Weekly files are generated every day at 2:00 GMT (see [cloudwatch rule](https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#rules:name=fulfilment-lambdas-PROD-WeeklyScheduledRule-1QIVLQ8W0XG6M)). Each time a set of fulfilment files for all regions is generated for the next Friday that is at least 8 days away.
This guarantees that we only generate files that have not been uploaded to salesforce yet.

Guardian Weekly files will be automatically uploaded to salesforce every Thursday at 11:00 GMT (see [cloudwatch rule](https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#rules:name=fulfilment-lambdas-PROD-WeeklyScheduledUploadRule-NRHNG387CPKL)). Files are uploaded a week in advance, so each Thursday the uploaded files are not the ones used for delivery the next day but the Friday on the following week.

## Running Locally

Each lambda can be run locally using the appropriate `yarn run:` command. This uses [lambda-local](https://github.com/ashiina/lambda-local) to emulate the AWS environment. 
_Note: A specific build is referenced in package.json as there is a bug in lambda-local regarding aws credentials that hasn't been fixed in master_

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

## Glossary

|System           |Name                             |Description                                                                                |
|-----------------|---------------------------------|------------------------------------------------------------------------------------------ |
|AWS Step         |QueryZuora                       |`querier.js`                                                                               |
|AWS Step         |FetchResults                     |`fetcher.js`                                                                               |
|AWS Step         |GenerateFulfilmentFiles          |`exporter.js`                                                                              |
|AWS Lambda       |salesforce_uploader              |`salesforce_uploader.js` uploads Home Delivery; behind fulfilment-api                      |
|AWS Lambda       |weekly-fulfilmentUploader        |`/weekly/salesforce_uploader.js` uploads Guardian Weekly; triggered on a schedule          |
|AWS S3           |zuoraExport                      |raw zuora CSV export                                                                       |
|AWS S3           |fulfilments                      |Guardian Weekly                                                                            |
|AWS S3           |fulfilment_output                |Home Delivery                                                                              |
|AWS S3           |uploaded                         |Home Delivery manually uploaded files to SF                                                |
|AWS API          |fulfilment-api                   |API hit by SF to manually trigger upload of Home Delivery via `salesforce_uploader.js`     |
|SF Document      |Home_Delivery_Pipeline_Fulfilment|Document where Home Delivery CSV is manually uploaded via 'Home Delivery Reports' page     |
|SF Document      |weekly_sample_files              |Document where Guardian weekly CSV is automatically uploaded on a schedule                 |
|SF Page          |Home Delivery Reports            |Page where CSR can manually trigger upload of Home Delivery CSV                            |
|SF User          |Fulfilment User API              |Credentials for upload to SF are in gu-reader-revenue-private/membership/fulfilment-lambdas|

## Build and Deployment

We use TeamCity for CI on this project.

All changes merged to master are automatically deployed to production by [Riff-Raff](https://github.com/guardian/riff-raff).

## Cloudforming

Because of limitations in cloudformation templates we need an additional step to update the stacks :
1. Make the required changes in [cloudformation/cloudformation.yaml](https://github.com/guardian/fulfilment-lambdas/blob/master/cloudformation/cloudformation.yaml)
2. Run 'yarn cloudform'. Stage specific versions of the cloudformation template will be generated
3. Use the generated version for the desired stage to update the stack (it will be in cloudformation/[stage].yaml)
