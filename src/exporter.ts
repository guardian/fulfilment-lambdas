import { Handler } from "aws-lambda";
import type { fulfilmentType } from "./lib/config";
import { weeklyExport } from "./weekly/export";
import { homedeliveryExport } from "./homedelivery/export";
import util from "util";

export type result = {
  queryName: string;
  fileName: string;
};
export type Input = {
  deliveryDate: string;
  results: Array<result>;
  type: fulfilmentType;
};

export const handler: Handler<
  Input,
  {
    fulfilmentFile: any;
    deliveryDate: string;
    results: Array<result>;
    type: fulfilmentType;
  }
> = async (event: Input) => {
  const generateFulfilmentFiles = async (type: string) => {
    if (type === "homedelivery") {
      return homedeliveryExport(event);
    } else if (type === "weekly") {
      return weeklyExport(event);
    } else throw Error(`Invalid type field ${util.inspect(event)}`);
  };

  try {
    const outputFileName = await generateFulfilmentFiles(event.type);
    return { ...event, fulfilmentFile: outputFileName };
  } catch (err) {
    throw new Error(
      `Failed to generate fulfilment files in S3: ${util.inspect(err)}`
    );
  }
};
