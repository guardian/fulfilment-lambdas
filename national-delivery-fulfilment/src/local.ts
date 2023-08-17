import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const client = new S3Client({ region: "eu-west-1" });
import { main } from "./main";

main();