This readme is a skeleton, please fill me out with some useful info!

# fulfilment-lambdas
This is a set of lambdas in a step function to allow us to fulfil from zuora.

They are built in ES6, using [StandardJS](https://standardjs.com) and [Flow](http://flow.org).

It is automatically built using teamcity and riffraff as CODE or PROD as appropriate.

The credentials come from S3 bucket ....


## Running Locally

Each lambda can be run locally using the appropriate `yarn run:` command. This uses [lambda-local](https://github.com/ashiina/lambda-local) to emulate the AWS environment. 
_Note: A specific build is referenced in `package.json` as there is a bug in lambda-local regarding aws credentials that hasn't been fixed in master_

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

## Verifier
There is a separate lambda to allow correctness checking.

## Salesforce Downloader
This download the salesforce files every night so we can compare with the Zuora files on an ongoing basis.
```bash
yarn run:sf
```
