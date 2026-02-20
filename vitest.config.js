import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '**/node_modules/**',
        'workplaces/**/types/**',
        'workplaces/**/examples/**',
        'workplaces/**/public/**',
        '*.config.js',
        '**/dist/**',
        'test/**',
      ],
      include: [
        'workplaces/p2p-console-viewer-lib/src/**/*.js',
        'workplaces/p2p-console-viewer-server/**/*.js',
      ],
    },
  },
});
