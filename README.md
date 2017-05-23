This readme is a skeleton, please fill me out with some useful info!

# fulfilment-lambdas
This is a set of lambdas in a step function to allow us to fulfil from zuora.

It is automatically built using teamcity and riffraff as CODE or PROD as appropriate.

The credentials come from S3 bucket ....

To test/run the lambda, go to the AWS console and create a new execution of the step function.

The output from the job is placed in the S3 bucket ....

## Verifier
There is a separate lambda to allow correctness checking.
This download the salesforce files every night so we can compare with the Zuora files on an ongoing basis.
