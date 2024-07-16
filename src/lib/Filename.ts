import { Moment } from "moment";

const OUTPUT_DATE_FORMAT = "YYYY-MM-DD";

export class Filename {
  date: Moment;
  filename: string;
  constructor(date: Moment, filename: string) {
    this.date = date;
    this.filename = filename;
  }
}

export function generateFilename(
  date: Moment,
  product: string,
  maybeCountry?: string,
  maybeFileType?: string
) {
  const fileType = maybeFileType || "csv";
  const parts = [date.format(OUTPUT_DATE_FORMAT), product, maybeCountry]
    .filter((i) => i)
    .join("_");
  return new Filename(date, `${parts}.${fileType}`);
}
