import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// rvlog uses reflect-metadata-backed decorators. esbuild (Vite's default) supports
// experimentalDecorators from tsconfig.json — no extra config required here.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@kangjuhyup\/rvlog$/,
        replacement: fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
      },
      {
        find: /^@kangjuhyup\/rvlog-react$/,
        replacement: fileURLToPath(new URL('../../packages/rvlog-react/src/index.ts', import.meta.url)),
      },
    ],
  },
});
