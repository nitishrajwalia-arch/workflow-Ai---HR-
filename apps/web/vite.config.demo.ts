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
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    // Nothing is served from a URL here, so there is nothing to cache-bust and
    // no second request to save.
    sourcemap: false,
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
