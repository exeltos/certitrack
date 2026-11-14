import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { PAGES } from './scripts/build-pages.mts';

// The browser must not paint a page before its script has drawn the frame,
// otherwise every menu click flashes an empty page. Vite drops the attribute
// from the page entry script while bundling, so it is put back here.
const renderBlockingEntry = {
  name: 'render-blocking-entry',
  transformIndexHtml: {
    order: 'post' as const,
    handler: (html: string) => html.replace(/<script type="module" crossorigin src=/, '<script type="module" blocking="render" crossorigin src=')
  }
};

// Multi-page app: every HTML shell is an entry point.
export default defineConfig({
  root: '.',
  plugins: [renderBlockingEntry],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(
        [...Object.keys(PAGES), 'pages/organization/compliance.html']
          .map(f => [f.replace(/\.html$/, ''), resolve(__dirname, f)])
      )
    }
  },
  server: { host: '127.0.0.1', port: 8888, strictPort: true },
  preview: { host: '127.0.0.1', port: 8888, strictPort: true },
  test: { include: ['tests/unit/**/*.test.{js,ts}'] }
});
