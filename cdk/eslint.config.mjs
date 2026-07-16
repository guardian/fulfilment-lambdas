import guardian from '@guardian/eslint-config';

export default [
	{
		ignores: ['cdk.out', 'dist', 'jest.setup.js', '**/*.js', '**/*.d.ts'],
	},
	...guardian.configs.recommended,
	...guardian.configs.jest,
];
