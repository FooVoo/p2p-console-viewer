import rootConfig from '../../eslint.config.js';
import globals from 'globals';

export default [
	// Extend root configuration
	...rootConfig,
	{
		files: ['src/**/*.js'],
		languageOptions: {
			sourceType: 'module',
			globals: {
				...globals.browser
			}
		}
	},
	{
		ignores: ['node_modules/**', 'dist/**', 'types/**', 'examples/**']
	}
];
