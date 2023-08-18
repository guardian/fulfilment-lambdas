
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

import { example_s3 } from './examples/learning-s3-lib'

export const main = async () => {
  console.log("main()");

  // Writing to S3 from aws using a client without set credentials
  const client = new S3Client({ region: "eu-west-1" });
  await example_s3(client);
};

