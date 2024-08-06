import type { fulfilmentType } from './lib/config';
import { weeklyExport } from './weekly/export';
import { homedeliveryExport } from './homedelivery/export';
import util from 'util';

export type result = {
	queryName: string;
	fileName: string;
};
export type Input = {
	deliveryDate: string;
	results: Array<result>;
	type: fulfilmentType;
};

export const handler = async (input: Input) => {
	const generateFulfilmentFiles = async (type: string) => {
		if (type === 'homedelivery') {
			return homedeliveryExport(input);
		} else if (type === 'weekly') {
			return weeklyExport(input);
		} else throw Error(`Invalid type field ${util.inspect(input)}`);
	};

	try {
		const outputFileName = await generateFulfilmentFiles(input.type);
		return { ...input, fulfilmentFile: outputFileName };
	} catch (err) {
		throw new Error(
			`Failed to generate fulfilment files in S3: ${util.inspect(err)}`,
		);
	}
};
