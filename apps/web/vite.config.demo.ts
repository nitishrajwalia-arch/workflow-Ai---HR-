/**
 * The shareable demo build.
 *
 * One self-contained HTML file: the interface on its own seeded data, no server,
 * nothing to install. It is what you send someone who asks "can I see it?"
 * before there is anywhere to deploy it.
 *
 * Everything is inlined by `scripts/build-demo.mjs` afterwards, so this config
 * only has to stop Vite splitting the output into files that would then have to
 * be hosted somewhere.
 */
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // The one substitution that makes this build work with no server: the
      // api module is replaced, so the real providers and the real screens run
      // unchanged against a fixed payload.
      { find: /^\.\.\/lib\/api\.js$/, replacement: here('./src/preview/api.ts') },
      { find: /^\.\/lib\/api\.js$/, replacement: here('./src/preview/api.ts') },
    ],
  },
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    // Nothing is served from a URL here, so there is nothing to cache-bust and
    // no second request to save.
    sourcemap: false,
    minify: process.env.PREVIEW_DEBUG ? false : 'esbuild',
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: 'standalone.html',
      output: {
        // One chunk. The splitting in vite.config.ts exists so a change to the
        // app does not re-download React; a single file has no such choice.
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: 'demo.js',
        assetFileNames: 'demo.[ext]',
      },
    },
  },
});
