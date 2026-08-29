import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /**
     * Everything under /api and /uploads goes to the API in development.
     *
     * This means the browser only ever talks to one origin, so the refresh
     * cookie is same-site and there is no CORS in the loop while you work.
     * Production does the same thing at the reverse proxy — see
     * docs/DEPLOYMENT.md — which keeps dev and production honest with each other.
     */
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    // Source maps in production: a stack trace from a site-office phone that
    // reads `a.b is not a function` costs more than the few hundred KB.
    sourcemap: true,
    rollupOptions: {
      output: {
        /*
         * Keep React and the icon set in their own chunks so a change to the
         * app does not force every user to re-download the vendor code.
         *
         * Written as a function rather than the old `{ name: [modules] }`
         * object, which Vite 8's bundler no longer accepts.
         */
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react';
          }
          if (id.includes('node_modules/lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
});
