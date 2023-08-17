// https://www.npmjs.com/package/aws-sdk
// https://github.com/aws/aws-sdk-js
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const client = new S3Client({ region: "eu-west-1" });

export const main = async () => {
  const command = new PutObjectCommand({
    Bucket: "national-delivery-fulfilment-code",
    Key: "hello-s3.txt",
    Body: "Hello S3!",
  });

  try {
    const response = await client.send(command);
    console.log(response);
  } catch (err) {
    console.error(err);
  }
};
