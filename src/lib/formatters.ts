import * as csv from 'fast-csv';

// https://c2fo.github.io/fast-csv/docs/formatting/examples
export function csvFormatterForSalesforce(headers) {
	return csv.format({ headers: headers, quoteColumns: true });
}

export function formatPostCode(postCode) {
	/**
	 * Supplier requirements:
	 * 1) all caps
	 * 2) space before final three chars
	 */
	const normalised = postCode.replace(/ /g, '').toUpperCase();
	const length = normalised.length;
	const outward = normalised.substring(0, length - 3);
	const inward = normalised.substring(length - 3);
	return `${outward} ${inward}`;
}

/**
 * Needed because Salesforce CsvReader bug:
 *   Clarify with tests current behaviour of CsvReader regarding quotes and commas #333
 *   https://github.com/guardian/salesforce/pull/333
 *
 * Replace double quotes " with single quotes ' because Salesforce CSV parser gets confused if it sees
 * double quotes followed by a comma ", within the column value itself, for example:
 *
 * BEFORE:
 *  "front door is on "Foo's Drive ",Put though the letterbox, do not leave on door step."
 *
 * AFTER:
 *  "front door is on 'Foo's Drive ',Put though the letterbox, do not leave on door step."
 *
 */
export function formatDeliveryInstructions(deliveryInstructions) {
	return deliveryInstructions.replace(/"/g, "'");
}
