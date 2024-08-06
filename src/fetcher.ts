import { Handler } from 'aws-lambda';
import { fetchConfig } from './lib/config';
import NamedError from './lib/NamedError';
import { upload } from './lib/storage';
import { Zuora } from './lib/Zuora';

export type Input = { jobId: string; deliveryDate: string };

const uploadFile = async (fileData: {
	fileName: string;
	batchName: string;
	data: Buffer;
}) => {
	const savePath = `zuoraExport/${fileData.fileName}`;
	const result = await upload(fileData.data.toString(), savePath);
	return {
		queryName: fileData.batchName,
		fileName: fileData.fileName,
		s3: result,
	};
};

export const handler: Handler<Input> = async (input, _, callback) => {
	try {
		if (
			input == null ||
			input.jobId == null ||
			typeof input.jobId !== 'string' ||
			input.deliveryDate == null ||
			typeof input.deliveryDate !== 'string'
		) {
			callback(new NamedError('inputerror', 'Input to fetcher was invalid'));
			return;
		}

		const results = await asyncHandler(input);
		callback(null, { ...input, results });
	} catch (err) {
		console.log(err);
		callback(JSON.stringify(err));
	}
};

const asyncHandler = async (input: Input) => {
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
	const result = uploads.map((data) => uploadFile(data));
	console.log('Returning.');
	return Promise.all(result);
};
