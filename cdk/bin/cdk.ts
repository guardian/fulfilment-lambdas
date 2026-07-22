import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { FulfilmentLambdas } from '../lib/fulfilment-lambdas';

const app = new App();

// The CloudFormation stack names must stay exactly as riff-raff currently deploys them
// (cloudFormationStackName: fulfilment-lambdas + appendStageToCloudFormationStackName),
// so CloudFormation performs an in-place update rather than creating new stacks.
new FulfilmentLambdas(app, 'fulfilment-lambdas-CODE', {
	stack: 'membership',
	stage: 'CODE',
	env: { region: 'eu-west-1' },
	cloudFormationStackName: 'fulfilment-lambdas-CODE',
});

new FulfilmentLambdas(app, 'fulfilment-lambdas-PROD', {
	stack: 'membership',
	stage: 'PROD',
	env: { region: 'eu-west-1' },
	cloudFormationStackName: 'fulfilment-lambdas-PROD',
});
