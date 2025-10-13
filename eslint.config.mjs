import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
				project: './tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			// Allow console.log (common in Lambda functions)
			'no-console': 'off',
			// TypeScript handles these
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^inputHeaders$' },
			],
			// Allow @ts-ignore in this legacy codebase
			'@typescript-eslint/ban-ts-comment': 'off',
		},
	},
	{
		files: ['__tests__/**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 2020,
				sourceType: 'module',
				project: './tsconfig.json',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			// Allow console.log in tests
			'no-console': 'off',
			// Allow require() in test files (common with Jest)
			'@typescript-eslint/no-require-imports': 'off',
			// Allow @ts-ignore in tests
			'@typescript-eslint/ban-ts-comment': 'off',
			// Allow any in tests
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
		},
	},
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
	},
];
