import { Handler } from "aws-lambda";
import { homedeliveryQuery } from "./homedelivery/query";
import { weeklyQuery } from "./weekly/query";
import type { fulfilmentType } from "./lib/config";
import util from "util";

export type Input = {
  type: fulfilmentType;
  deliveryDate?: string;
  deliveryDateDaysFromNow?: number;
  deliveryDayOfWeek?: string;
  minDaysInAdvance?: number;
};

export const handler: Handler = async (event, context, callback) => {
  const startZuoraBatchJobs = async () => {
    if (event.type === "homedelivery") {
      return homedeliveryQuery(event);
    } else if (event.type === "weekly") {
      return weeklyQuery(event);
    } else throw Error(`Invalid type field ${util.inspect(event)}`);
  };
  try {
    const res = await startZuoraBatchJobs();
    return { ...event, jobId: res.jobId, deliveryDate: res.deliveryDate };
  } catch (err) {
    throw new Error(
      `Failed to start Zuora export batch jobs ${util.inspect(err)}`
    );
  }
};
