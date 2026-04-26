import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@kangjuhyup\/rvlog$/,
        replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      },
    ],
  },
});
