import { join } from 'path';
import { GuScheduledLambda } from '@guardian/cdk';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import type { App } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';

export class NationalDeliveryFulfilment extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		const app = 'national-delivery-fulfilment';
		const nationalDeliveryFulfilmentLambda = new GuScheduledLambda(
			this,
			'national-delivery-fulfilment-lambda',
			{
				description: 'A lambda to handle fulfilment for national delivery',
				functionName: `membership-${app}-${this.stage}`,
				handler: 'national-delivery-fulfilment/index.handler',
				runtime: Runtime.NODEJS_18_X,
				memorySize: 1024,
				fileName: `${app}.zip`,
				app: app,
				rules: [],
				monitoringConfiguration: { noMonitoring: true },
			},
		);
	}
}
