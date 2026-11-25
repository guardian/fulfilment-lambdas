import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { FulfilmentLambdas } from './fulfilment-lambdas';

describe('The fulfilment-lambdas stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const codeStack = new FulfilmentLambdas(app, 'fulfilment-lambdas-CODE', {
			stack: 'membership',
			stage: 'CODE',
			env: { region: 'eu-west-1' },
		});
		const prodStack = new FulfilmentLambdas(app, 'fulfilment-lambdas-PROD', {
			stack: 'membership',
			stage: 'PROD',
			env: { region: 'eu-west-1' },
		});

		expect(Template.fromStack(codeStack).toJSON()).toMatchSnapshot();
		expect(Template.fromStack(prodStack).toJSON()).toMatchSnapshot();
	});

	it.each(['CODE', 'PROD'] as const)(
		'configures the shared Salesforce connected app credentials in %s',
		(stage) => {
			const app = new App();
			const stack = new FulfilmentLambdas(app, `fulfilment-lambdas-${stage}`, {
				stack: 'membership',
				stage,
				env: { region: 'eu-west-1', account: '865473395570' },
			});
			const template = Template.fromStack(stack);

			for (const functionName of [
				`zuora_fulfilment_salesforce_downloader-${stage}`,
				`weekly-fulfilmentUploader-${stage}`,
				`salesforce_uploader-${stage}`,
			]) {
				template.hasResourceProperties('AWS::Lambda::Function', {
					FunctionName: functionName,
					Environment: {
						Variables: Match.objectLike({
							SECRET_NAME_CONNECTED_APP: `${stage}/Salesforce/ConnectedApp/PrintFulfilment`,
						}),
					},
				});
			}

			template.hasResourceProperties('AWS::IAM::Role', {
				Policies: Match.arrayWith([
					Match.objectLike({
						PolicyName: 'SalesforceCredentials',
						PolicyDocument: {
							Statement: [
								{
									Action: 'secretsmanager:GetSecretValue',
									Effect: 'Allow',
									Resource: `arn:aws:secretsmanager:eu-west-1:865473395570:secret:${stage}/Salesforce/ConnectedApp/PrintFulfilment-*`,
								},
							],
							Version: '2012-10-17',
						},
					}),
				]),
			});
		},
	);
});
