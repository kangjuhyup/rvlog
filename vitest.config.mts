import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const sharedExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/dist-benchmark/**',
  '**/coverage/**',
  '**/example/**',
  '**/benchmark/**',
  '**/logs/**',
];

const sharedCoverageExclude = [
  '**/dist/**',
  '**/dist-benchmark/**',
  '**/*.d.ts',
  '**/*.d.cts',
  '**/*.d.mts',
  '**/vitest.config.ts',
  '**/vitest.config.mts',
  'benchmark/**',
  'dist-benchmark/**',
  'example/**',
  'src/**/*.test.ts',
  'packages/**/*.test.ts',
  'packages/**/*.test.tsx',
  'src/index.ts',
  'src/node.ts',
  'src/decorators/mask-log.decorator.ts',
  'src/formatters/log-formatter.ts',
  'src/notification/notification-channel.ts',
  'packages/rvlog-react/src/index.ts',
  'packages/rvlog-nest/src/index.ts',
];

const sharedCoverageInclude = [
  'src/**/*.ts',
  'packages/rvlog-nest/src/**/*.ts',
  'packages/rvlog-react/src/**/*.ts',
];

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@kangjuhyup\/rvlog$/,
        replacement: resolve(import.meta.dirname, 'dist/index.js'),
      },
      {
        find: /^@kangjuhyup\/rvlog\/node$/,
        replacement: resolve(import.meta.dirname, 'dist/node.js'),
      },
      {
        find: /^@kangjuhyup\/rvlog-nest$/,
        replacement: resolve(import.meta.dirname, 'packages/rvlog-nest/src/index.ts'),
      },
      {
        find: /^@kangjuhyup\/rvlog-react$/,
        replacement: resolve(import.meta.dirname, 'packages/rvlog-react/src/index.ts'),
      },
    ],
  },
  test: {
    globals: true,
    reporters: ['verbose'],
    server: {
      deps: {
        inline: [
          /^@kangjuhyup\/rvlog$/,
          /^@kangjuhyup\/rvlog\/node$/,
          /^@kangjuhyup\/rvlog-react$/,
          /^@kangjuhyup\/rvlog-nest$/,
          /^@opentelemetry\/api$/,
        ],
      },
    },
    coverage: {
      provider: 'v8',
      all: true,
      include: sharedCoverageInclude,
      exclude: sharedCoverageExclude,
      excludeAfterRemap: true,
    },
    projects: [
      {
        test: {
          name: 'core',
          include: ['src/**/*.test.ts'],
          exclude: sharedExclude,
          environment: 'node',
        },
      },
      {
        test: {
          name: 'nest',
          include: ['packages/rvlog-nest/**/*.test.ts'],
          exclude: sharedExclude,
          environment: 'node',
        },
      },
      {
        test: {
          name: 'react',
          include: ['packages/rvlog-react/**/*.test.{ts,tsx}'],
          exclude: sharedExclude,
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'otel',
          include: ['packages/rvlog-otel/**/*.test.ts'],
          exclude: sharedExclude,
          environment: 'node',
        },
      },
    ],
  },
});
