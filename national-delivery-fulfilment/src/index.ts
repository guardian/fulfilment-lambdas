import { APIGatewayProxyCallback, Context } from "aws-lambda";
import { helloWorld } from "./something";

export function handler(
  event: APIGatewayEvent,
  context: Context,
  callback: APIGatewayProxyCallback
) {
  helloWorld();
}

export interface APIGatewayEvent {
  headers: Record<string, string | undefined>;
  path: string;
  body: string;
}
