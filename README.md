# fulfilment-lambdas
This project generates newspaper fulfilment files for the Home Delivery and Guardian Weekly products, currently sold [here](https://subscribe.theguardian.com).

The file generation process is written as an [AWS Step Function](https://aws.amazon.com/step-functions/), which queries the subscription data in Zuora and constructs files based on the results.

These files are uploaded to Salesforce, so that various distributors can download them. The upload process is carried out via a separate lambda (salesforce_uploader), and is triggered by a scheduled CloudWatch event (i.e. it is not part of the Step Function).

There are various other lambdas in the project for file comparison and correctness checking. These are also currently triggered by scheduled CloudWatch events.

All lambdas in this project are built in ES6, using [StandardJS](https://standardjs.com) and [Flow](http://flow.org).

## Running Locally

Each lambda can be run locally using the appropriate `yarn run:` command. This uses [lambda-local](https://github.com/ashiina/lambda-local) to emulate the AWS environment. 
_Note: A specific build is referenced in package.json as there is a bug in lambda-local regarding aws credentials that hasn't been fixed in master_

To install dependencies for running locally:
```bash
yarn dist
yarn install 
```
And to transpile the lambdas:
```bash
yarn compile
```
This will transpile any ES6/7 into javascript which will run on the Node 6.10 environment of AWS.

## Build and Deployment

We use TeamCity for CI on this project.

All changes merged to master are automatically deployed to production by [Riff-Raff](https://github.com/guardian/riff-raff).
