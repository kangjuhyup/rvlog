import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@kangjuhyup\/rvlog$/,
        replacement: resolve(import.meta.dirname, '../../dist/index.js'),
      },
      {
        find: /^@kangjuhyup\/rvlog\/node$/,
        replacement: resolve(import.meta.dirname, '../../dist/node.js'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    server: {
      deps: {
        inline: [/^@kangjuhyup\/rvlog$/, /^@kangjuhyup\/rvlog\/node$/],
      },
    },
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
