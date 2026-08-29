/**
 * Process entry point.
 *
 * Everything interesting is in app.ts. This file only starts it, and — the part
 * people forget — stops it properly.
 *
 * A graceful shutdown matters in production: the orchestrator sends SIGTERM and
 * then kills the process a few seconds later. Without this, in-flight requests
 * are cut off mid-response and open transactions are left for Postgres to time
 * out. With it, the server stops accepting new connections, finishes what it is
 * doing, closes the pool, and exits.
 */

import { buildApp } from './app.js';
import { loadEnv } from './env.js';

/**
 * Load .env for local development.
 *
 * Node 22 does this natively, so there is no dotenv dependency. In production
 * there is usually no .env file at all — the platform injects real environment
 * variables — so a missing file is normal and must not stop the process.
 * Anything genuinely required is caught by loadEnv() a line later, with a
 * message naming exactly what is missing.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env here. Fine: the environment itself is expected to carry the values.
}

const env = loadEnv();

const app = await buildApp({ env });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(
    { port: env.PORT, docs: env.ENABLE_DOCS ? `http://localhost:${env.PORT}/docs` : 'disabled' },
    'Marbella HR API is up',
  );
} catch (err) {
  app.log.fatal({ err }, 'failed to start');
  process.exit(1);
}

let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    // A second Ctrl-C should not start a second shutdown on top of the first.
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');

    // If graceful shutdown itself hangs, do not hang for ever: the orchestrator
    // will SIGKILL us anyway, and an ugly exit we chose beats one we did not.
    const hardStop = setTimeout(() => {
      app.log.error('shutdown took too long; exiting anyway');
      process.exit(1);
    }, 10_000);
    hardStop.unref();

    app
      .close()
      .then(() => process.exit(0))
      .catch((err: unknown) => {
        app.log.error({ err }, 'error during shutdown');
        process.exit(1);
      });
  });
}

// A rejected promise nobody handled has left the process in a state we cannot
// reason about. Log it loudly and let the orchestrator restart us clean.
process.on('unhandledRejection', (reason) => {
  app.log.fatal({ reason }, 'unhandled promise rejection');
  process.exit(1);
});
