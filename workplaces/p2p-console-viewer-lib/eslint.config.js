import rootConfig from '../../eslint.config.js';

export default [
	// Extend root configuration
	...rootConfig,
	{
		files: ['src/**/*.js'],
		languageOptions: {
			sourceType: 'module'
		}
	},
	{
		ignores: ['node_modules/**', 'dist/**', 'types/**', 'examples/**']
	}
];
