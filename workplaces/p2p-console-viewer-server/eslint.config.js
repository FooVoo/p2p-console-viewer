import rootConfig from '../../eslint.config.js';

export default [
	// Extend root configuration
	...rootConfig,
	{
		files: ['*.js'],
		languageOptions: {
			sourceType: 'commonjs',
			globals: {
				__dirname: 'readonly',
				require: 'readonly',
				module: 'readonly',
				exports: 'readonly',
				process: 'readonly'
			}
		}
	},
	{
		ignores: ['node_modules/**']
	}
];
