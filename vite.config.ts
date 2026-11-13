import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { PAGES } from './scripts/build-pages.mjs';

// Multi-page app: every HTML shell is an entry point.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(
        [...Object.keys(PAGES), 'pages/organization/compliance.html']
          // The demo is not part of the public site; only test builds include it.
          .filter(f => f !== 'pages/demo/index.html' || process.env.VITE_ENABLE_DEMO === 'true')
          .map(f => [f.replace(/\.html$/, ''), resolve(__dirname, f)])
      )
    }
  },
  server: { host: '127.0.0.1', port: 8888, strictPort: true },
  preview: { host: '127.0.0.1', port: 8888, strictPort: true },
  test: { include: ['tests/unit/**/*.test.{js,ts}'] }
});
