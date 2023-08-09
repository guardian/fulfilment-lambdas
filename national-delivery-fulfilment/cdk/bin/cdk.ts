import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { NationalDeliveryFulfilment } from "../lib/national-delivery-fulfilment";

const app = new App();
new NationalDeliveryFulfilment(app, "NationalDeliveryFulfilment-CODE", { stack: "membership", stage: "CODE" });
new NationalDeliveryFulfilment(app, "NationalDeliveryFulfilment-PROD", { stack: "membership", stage: "PROD" });
