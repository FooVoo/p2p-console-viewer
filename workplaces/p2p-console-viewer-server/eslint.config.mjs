import rootConfig from '../../eslint.config.js';

export default [
	// Extend root configuration
	...rootConfig,
	{
		files: ['**/*.js'],
		languageOptions: {
			sourceType: 'module',
			globals: {
				process: 'readonly'
			}
		}
	},
	{
		ignores: ['node_modules/**']
	}
];
