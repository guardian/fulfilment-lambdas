import { APIGatewayProxyCallback, Context } from "aws-lambda";

export function handler(
  event: APIGatewayEvent,
  context: Context,
  callback: APIGatewayProxyCallback
) {
  console.log("We ran!");
}

export interface APIGatewayEvent {
  headers: Record<string, string | undefined>;
  path: string;
  body: string;
}
