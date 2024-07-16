import moment, { Moment } from "moment";
import type { S3Folder } from "../lib/storage";
import { getCanadianState, getUSState } from "../lib/states";
import { csvFormatterForSalesforce } from "../lib/formatters";

// input headers
const ADDRESS_1 = "SoldToContact.Address1";
const ADDRESS_2 = "SoldToContact.Address2";
const CITY = "SoldToContact.City";
const COUNTRY = "SoldToContact.Country";
const TITLE = "SoldToContact.Title__c";
const FIRST_NAME = "SoldToContact.FirstName";
const LAST_NAME = "SoldToContact.LastName";
const POSTAL_CODE = "SoldToContact.PostalCode";
const SUBSCRIPTION_NAME = "Subscription.Name";
const COMPANY_NAME = "SoldToContact.Company_Name__c";
const SHOULD_HAND_DELIVER = "Subscription.CanadaHandDelivery__c";
const STATE = "SoldToContact.State";

const inputHeaders = [
  ADDRESS_1,
  ADDRESS_2,
  CITY,
  COUNTRY,
  TITLE,
  FIRST_NAME,
  LAST_NAME,
  POSTAL_CODE,
  SUBSCRIPTION_NAME,
  COMPANY_NAME,
  SHOULD_HAND_DELIVER,
  STATE,
];

type InputHeader = (typeof inputHeaders)[number];

type InputRow = {
  [key in InputHeader]: string;
};

// output headers
const CUSTOMER_REFERENCE = "Subscriber ID";
const CUSTOMER_FULL_NAME = "Name";
const CUSTOMER_COMPANY_NAME = "Company name";
const CUSTOMER_ADDRESS_LINE_1 = "Address 1";
const CUSTOMER_ADDRESS_LINE_2 = "Address 2";
const CUSTOMER_ADDRESS_LINE_3 = "Address  3"; // extra space added on purpose to replicate sf file
const CUSTOMER_COUNTRY = "Country";
const CUSTOMER_POSTCODE = "Post code";
const DELIVERY_QUANTITY = "Copies";
const UNIT_PRICE = "Unit price";
const CURRENCY = "Currency";

export const outputHeaders = [
  CUSTOMER_REFERENCE,
  CUSTOMER_FULL_NAME,
  CUSTOMER_COMPANY_NAME,
  CUSTOMER_ADDRESS_LINE_1,
  CUSTOMER_ADDRESS_LINE_2,
  CUSTOMER_ADDRESS_LINE_3,
  CUSTOMER_COUNTRY,
  CUSTOMER_POSTCODE,
  DELIVERY_QUANTITY,
];

type OutputHeader = (typeof outputHeaders)[number];

type OutputRow = {
  [key in OutputHeader]: string;
} & { "Unit price": number; Currency: string };

export class WeeklyExporter {
  countries: string[];
  sentDate: string;
  formattedDeliveryDate: string;
  chargeDay: string;
  writeCSVStream: any;
  folder: S3Folder;

  constructor(
    countries: string[] | string,
    deliveryDate: Moment,
    folder: S3Folder
  ) {
    this.countries = typeof countries === "string" ? [countries] : countries;

    this.writeCSVStream = csvFormatterForSalesforce(outputHeaders);

    this.sentDate = moment().format("DD/MM/YYYY");
    this.chargeDay = deliveryDate.format("dddd");
    this.formattedDeliveryDate = deliveryDate.format("DD/MM/YYYY");
    this.folder = folder;
  }

  useForRow(row: { [key: string]: string }): boolean {
    // No need for trimmed or case-insensitive comparison as country field is from a picklist
    return this.countries.includes(row[COUNTRY] || "");
  }

  formatAddress(name: string) {
    return name.trim();
  }

  formatState(state: string) {
    return state.trim();
  }

  toUpperCase(value: string) {
    if (value) {
      return value.trim().toUpperCase();
    }
    return value;
  }

  getFullName(zTitle: string, zFirstName: string, zLastName: string) {
    let firstName = zFirstName.trim();
    if (firstName === ".") {
      firstName = "";
    }
    return [zTitle, firstName, zLastName.trim()].join(" ");
  }

  buildOutputCsv(row: InputRow) {
    const outputCsvRow: Partial<OutputRow> = {};
    const addressLine1 = [row[ADDRESS_1], row[ADDRESS_2]]
      .filter((x) => x)
      .join(", ");
    const fullName = this.getFullName(
      row[TITLE] || "",
      row[FIRST_NAME] || "",
      row[LAST_NAME] || ""
    );
    outputCsvRow[CUSTOMER_REFERENCE] = row[SUBSCRIPTION_NAME] || "";
    outputCsvRow[CUSTOMER_FULL_NAME] = this.formatAddress(fullName);
    outputCsvRow[CUSTOMER_COMPANY_NAME] = this.formatAddress(
      row[COMPANY_NAME] || ""
    );
    outputCsvRow[CUSTOMER_ADDRESS_LINE_1] = this.formatAddress(addressLine1);
    outputCsvRow[CUSTOMER_ADDRESS_LINE_2] = this.formatAddress(row[CITY] || "");
    outputCsvRow[CUSTOMER_ADDRESS_LINE_3] = this.formatState(row[STATE] || "");
    outputCsvRow[CUSTOMER_POSTCODE] = this.toUpperCase(row[POSTAL_CODE] || "");
    outputCsvRow[DELIVERY_QUANTITY] = "1.0";
    outputCsvRow[CUSTOMER_COUNTRY] = this.toUpperCase(row[COUNTRY] || "");
    return outputCsvRow;
  }

  processRow(row: InputRow) {
    if (row[SUBSCRIPTION_NAME] === "Subscription.Name") {
      return;
    }
    this.writeCSVStream.write(this.buildOutputCsv(row));
  }

  end() {
    this.writeCSVStream.end();
  }
}

export class UpperCaseAddressExporter extends WeeklyExporter {
  formatAddress(s: string) {
    return this.toUpperCase(s).trim();
  }

  formatState(s: string) {
    return this.toUpperCase(s);
  }
}

export class CaExporter extends WeeklyExporter {
  checkHandDelivery(handDeliveryValue: string): boolean {
    return handDeliveryValue.trim().toUpperCase() !== "YES";
  }

  useForRow(row: { [key: string]: string }): boolean {
    return (
      super.useForRow(row) &&
      this.checkHandDelivery(row[SHOULD_HAND_DELIVER] || "")
    );
  }

  formatState(s: string) {
    return getCanadianState(s);
  }
}

export class USExporter extends WeeklyExporter {
  formatState(s: string) {
    return getUSState(s);
  }
}

export class CaHandDeliveryExporter extends CaExporter {
  checkHandDelivery(handDeliveryValue: string): boolean {
    return handDeliveryValue.trim().toUpperCase() === "YES";
  }
}

const euCountries: string[] = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czechia",
  "Czech Republic",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
];

export class EuExporter extends WeeklyExporter {
  constructor(country: string, deliveryDate: Moment, folder: S3Folder) {
    super(country, deliveryDate, folder);
    const headers = this.append(outputHeaders, UNIT_PRICE, CURRENCY);
    this.writeCSVStream = csvFormatterForSalesforce(headers);
  }

  clone(arr: string[]): string[] {
    return arr.slice();
  }

  append(arr: string[], ...values: string[]): string[] {
    const appended = this.clone(arr);
    values.forEach((s) => appended.push(s));
    return appended;
  }

  contains(arr: string[], s: string): boolean {
    return arr.indexOf(s) > -1;
  }

  useForRow(row: { [key: string]: string }): boolean {
    // No need for trimmed or case-insensitive comparison as country field is from a picklist
    return this.contains(euCountries, row[COUNTRY] || "");
  }

  buildOutputCsv(row: InputRow) {
    const outputCsvRow = super.buildOutputCsv(row);
    /*
     * The arbitrary value of an individual Guardian Weekly
     * for the purposes of checks at the EU border.
     *
     * This was determined by the most common MRR (* 12 / 52 to give a weekly value)
     * of the batch of deliveries for the 24 Sep 2021 issue.
     */
    outputCsvRow[UNIT_PRICE] = 4.72;
    outputCsvRow[CURRENCY] = "EUR";
    return outputCsvRow;
  }
}
