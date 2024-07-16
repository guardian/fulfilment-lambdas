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

export const handler = async (input: Input) => {
  const startZuoraBatchJobs = async () => {
    if (input.type === "homedelivery") {
      return homedeliveryQuery(input);
    } else if (input.type === "weekly") {
      return weeklyQuery(input);
    } else throw Error(`Invalid type field ${util.inspect(input)}`);
  };
  try {
    const res = await startZuoraBatchJobs();
    return { ...input, jobId: res.jobId, deliveryDate: res.deliveryDate };
  } catch (err) {
    throw new Error(
      `Failed to start Zuora export batch jobs ${util.inspect(err)}`
    );
  }
};
