import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
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
});
