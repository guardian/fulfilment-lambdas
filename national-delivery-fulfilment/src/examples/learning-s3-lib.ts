
// ---------------------------------------------------------------------------------------
// This file was created by Pascal to illustrate how to write a file to S3 from TypeScript
// To run it write your credentials that you can get from Janus and run 
// $ npx ts-node src/local.ts from the `national-delivery-fulfilment` directory
// The outcome of running this function is that the file `hello-world-s3.txt` will be put in the 
// national-delivery-fulfilment-code bucket in the Membership AWS account.
// ---------------------------------------------------------------------------------------

// https://www.npmjs.com/package/aws-sdk
// https://github.com/aws/aws-sdk-js
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/

// Setting the permissions
// https://stackoverflow.com/questions/62552105/get-objects-from-aws-s3-bucket-in-typescript

// A nice source of information about connecting to S3 from TypeScript can be found here:
// https://github.com/guardian/tracker/

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
	Credentials,
} from 'aws-sdk/lib/core';

const credentials = new Credentials({
  accessKeyId: '[REMOVED]',
  secretAccessKey: '[REMOVED]',
  sessionToken: '[REMOVED]'
});

const client = new S3Client({ credentials: credentials, region: "eu-west-1" });

export const main = async () => {
  const command = new PutObjectCommand({
    Bucket: "national-delivery-fulfilment-code",
    Key: "hello-world.txt",
    Body: "Hello World!",
  });

  try {
    const response = await client.send(command);
    console.log(response);
  } catch (err) {
    console.error(err);
  }
};
