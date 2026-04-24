import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      rvlog: resolve(import.meta.dirname, '../../src/index.ts'),
      'rvlog/node': resolve(import.meta.dirname, '../../src/node.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/example/**',
      '**/logs/**',
    ],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        '**/dist/**',
        '**/dist-benchmark/**',
        '**/*.d.ts',
        '**/*.d.cts',
        '**/*.d.mts',
        '**/vitest.config.ts',
        '**/vitest.config.mts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/index.ts',
        '../example/**',
        '../../example/**',
        '../benchmark/**',
        '../../benchmark/**',
        '../dist-benchmark/**',
        '../../dist-benchmark/**',
      ],
      excludeAfterRemap: true,
    },
  },
});
