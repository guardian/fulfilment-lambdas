import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const example_s3 = async (client: S3Client) => {
  const command = new PutObjectCommand({
    Bucket: "gu-national-delivery-fulfilment-code",
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
