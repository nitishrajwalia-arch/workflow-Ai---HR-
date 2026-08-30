// Flat config (ESLint 9+).
//
// The rules here are the ones that catch real bugs. Style is Prettier's job and
// `eslint-config-prettier` turns off everything that would argue with it.

import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // The demo bundle: a megabyte of minified output, not source.
      '**/dist-demo/**',
      '**/node_modules/**',
      '**/coverage/**',
      // 7,300 lines of working, reviewed code that predates this setup.
      // Linting it now would produce hundreds of findings and zero bug fixes.
      'apps/web/src/legacy/**',
      // Generated verbatim from the single-file build.
      'apps/api/prisma/seed-data.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Type-aware linting for the server. It costs a few seconds and buys the
    // `no-floating-promises` rule below, which is worth far more than that.
    files: ['apps/api/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Explicit projects rather than `projectService: true`, because the
        // build tsconfigs exclude tests and prisma scripts and the service
        // then refuses to type them. These two widen the net; they never emit.
        project: ['./apps/api/tsconfig.lint.json', './packages/shared/tsconfig.lint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /*
       * An unawaited promise in a route handler is a request that answers
       * before its own database write has finished — the bug that looks like
       * "it saved, then it didn't". `void expr` is the explicit way to say
       * "yes, I mean to ignore this", and the rule accepts it.
       */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // Fastify hooks are typed as returning void but genuinely accept an
        // async function, so this one check would fire on every guarded route.
        { checksVoidReturn: false },
      ],
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // A missing dependency is a stale closure, and a stale closure in this
      // app means a screen showing data from before the last save.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  {
    // The two browser checks in scripts/ are plain Node ES modules, run by hand
    // against a running app. They print — that is their entire output.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  {
    // Scripts and tests legitimately print, and tests legitimately assert on
    // shapes that are `any`.
    files: [
      '**/*.test.ts',
      'apps/api/prisma/**/*.ts',
      'apps/api/src/tests/**/*.ts',
      '**/*.config.ts',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  prettier,
);
