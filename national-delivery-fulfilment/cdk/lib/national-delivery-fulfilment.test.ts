import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { NationalDeliveryFulfilment } from "./national-delivery-fulfilment";

describe("The NationalDeliveryFulfilment stack", () => {
  it("matches the snapshot", () => {
    const app = new App();
    const stack = new NationalDeliveryFulfilment(app, "NationalDeliveryFulfilment", { stack: "membership", stage: "TEST" });
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
  });
});
