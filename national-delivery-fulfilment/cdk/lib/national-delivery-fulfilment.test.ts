import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NationalDeliveryFulfilment } from './national-delivery-fulfilment';

describe('The NationalDeliveryFulfilment stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const codeStack = new NationalDeliveryFulfilment(
			app,
			'NationalDeliveryFulfilment-CODE',
			{ stack: 'membership', stage: 'CODE' },
		);
		const prodStack = new NationalDeliveryFulfilment(
			app,
			'NationalDeliveryFulfilment-PROD',
			{ stack: 'membership', stage: 'PROD' },
		);
		expect(Template.fromStack(codeStack).toJSON()).toMatchSnapshot();
		expect(Template.fromStack(prodStack).toJSON()).toMatchSnapshot();
	});
});
