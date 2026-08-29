import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    globalSetup: ['src/tests/global-setup.ts'],
    // These are INTEGRATION tests against a real PostgreSQL. They share one
    // database, so they run one file at a time rather than fighting over it.
    // Mocking the database would only test the mock.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
