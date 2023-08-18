//import { join } from 'path';
import { GuScheduledLambda } from '@guardian/cdk';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import {GuAllowPolicy} from "@guardian/cdk/lib/constructs/iam";
import type { App } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
//import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';


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

		const bucketName = `gu-national-delivery-fulfilment-${this.stage.toLowerCase()}`

        const dataBucket = new Bucket(this, 'DataBucket', {
          bucketName: bucketName,
        });

        nationalDeliveryFulfilmentLambda.addToRolePolicy(
          new PolicyStatement({
                actions: ['s3:PutObject', "s3:PutObjectAcl"],
              	effect: Effect.ALLOW,
              	resources: [`arn:aws:s3:::${bucketName}/*`],
          }),
        );
	}
}
