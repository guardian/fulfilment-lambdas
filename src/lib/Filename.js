// @flow
import moment from 'moment';

const OUTPUT_DATE_FORMAT = 'YYYY-MM-DD';

export class Filename {
	date: moment;
	filename: string;
	constructor(date: moment, filename: string) {
		this.date = date;
		this.filename = filename;
	}
}

export function generateFilename(
	date: moment,
	product: string,
	maybeCountry: ?string,
	maybeFileType: ?string,
) {
	const fileType = maybeFileType || 'csv';
	const parts = [date.format(OUTPUT_DATE_FORMAT), product, maybeCountry]
		.filter((i) => i)
		.join('_');
	return new Filename(date, `${parts}.${fileType}`);
}
