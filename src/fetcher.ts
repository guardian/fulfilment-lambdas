// @flow
import { fetchConfig } from './lib/config';
import NamedError from './lib/NamedError';
import { upload } from './lib/storage';
import { Zuora } from './lib/Zuora';
import type { result, Input as output } from './exporter';
export type input = { jobId: string, deliveryDate: string };

async function uploadFile(fileData, config): Promise<result> {
	const savePath = `zuoraExport/${fileData.fileName}`;
	const result = await upload(fileData.data.toString(), savePath);
	return {
		queryName: fileData.batchName,
		fileName: fileData.fileName,
		s3: result,
	};
}

export function handler(
	input: ?any,
	context: ?any,
	callback: (?Error, ?output) => void,
) {
	if (
		input == null ||
		input.jobId == null ||
		typeof input.jobId !== 'string' ||
		input.deliveryDate == null ||
		typeof input.deliveryDate !== 'string'
	) {
		callback(new NamedError('inputerror', 'Input to fetcher was invalid'));
		return null;
	}
	asyncHandler(input)
		.then((res) => callback(null, { ...input, results: res }))
		.catch((e) => {
			console.log(e);
			callback(e);
		});
}
async function asyncHandler(input: input): Promise<Array<result>> {
	// eslint-disable-line no-use-before-define
	const config = await fetchConfig();
	console.log('Config fetched succesfully.');
	const zuora = new Zuora(config);
	const batches = await zuora.getJobResult(input.jobId);
	console.log('Job results returned.');
	const files = batches.map((batch) =>
		zuora.fetchFile(batch, input.deliveryDate),
	);
	console.log('Downloading job results.');
	const uploads = await Promise.all(files);
	console.log('Generating upload');
	const result = uploads.map((data) => uploadFile(data, config));
	console.log('Returning.');
	return Promise.all(result);
}
