import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
	// Recommended base config with strict enforcement
	js.configs.recommended,
	
	// Prettier config to disable conflicting rules
	prettier,
	
	// Global configuration
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.es2021
			}
		},
		rules: {
			// Strict code quality rules
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'no-console': 'off', // Allow console in this project
			'eqeqeq': ['error', 'always'],
			'curly': ['error', 'all'],
			'no-var': 'error',
			'prefer-const': 'error',
			'prefer-arrow-callback': 'error',
			'no-throw-literal': 'error',
			'no-implicit-coercion': 'error',
			'no-return-await': 'error',
			'require-await': 'error',
			'no-async-promise-executor': 'error',
			'no-promise-executor-return': 'error',
		}
	}
];
