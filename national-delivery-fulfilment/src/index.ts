import { APIGatewayProxyCallback, Context } from "aws-lambda";
import { main } from "./main";

export async function handler(
  event: APIGatewayEvent,
  context: Context,
  callback: APIGatewayProxyCallback
) {
  await main();
}

export interface APIGatewayEvent {
  headers: Record<string, string | undefined>;
  path: string;
  body: string;
}
