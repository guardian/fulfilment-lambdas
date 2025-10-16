import { CloudWatch } from 'aws-sdk';

export const metricNamespace = 'fulfilment-lambdas';

const cloudwatch = new CloudWatch({ region: 'eu-west-1' });

export type Stage = 'CODE' | 'PROD';

const getStage = (): Stage => {
	const stage = process.env.Stage;
	if (!stage || (stage !== 'CODE' && stage !== 'PROD')) {
		throw new Error(`Invalid Stage: ${stage}`);
	}
	return stage as Stage;
};

export interface MetricDimensions {
	FulfilmentType?: 'homedelivery' | 'weekly';
	ErrorType?: string;
	[key: string]: string | undefined;
}

/**
 * Publish a count metric to CloudWatch
 */
export async function putMetric(
	metricName: string,
	value: number = 1,
	dimensions: MetricDimensions = {},
): Promise<void> {
	const stage = getStage();

	const metricDimensions: CloudWatch.Dimensions = [
		{
			Name: 'Stage',
			Value: stage,
		},
	];

	// Add optional dimensions
	Object.entries(dimensions).forEach(([key, value]) => {
		if (value) {
			metricDimensions.push({
				Name: key,
				Value: value,
			});
		}
	});

	const params: CloudWatch.PutMetricDataInput = {
		Namespace: metricNamespace,
		MetricData: [
			{
				MetricName: metricName,
				Value: value,
				Unit: 'Count',
				Dimensions: metricDimensions,
				Timestamp: new Date(),
			},
		],
	};

	try {
		await cloudwatch.putMetricData(params).promise();
	} catch (error) {
		// Don't fail the lambda if metrics publishing fails
		console.error('Failed to publish metric:', error);
	}
}

/**
 * Track validation errors for critical fields
 */
export async function putValidationError(
	errorType: string,
	fulfilmentType: 'homedelivery' | 'weekly',
	count: number = 1,
): Promise<void> {
	await putMetric('ValidationError', count, {
		FulfilmentType: fulfilmentType,
		ErrorType: errorType,
	});
}

/**
 * Track successful row processing
 */
export async function putRowsProcessed(
	fulfilmentType: 'homedelivery' | 'weekly',
	count: number,
): Promise<void> {
	await putMetric('RowsProcessed', count, {
		FulfilmentType: fulfilmentType,
	});
}
