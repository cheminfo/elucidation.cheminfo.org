import { defineConfig, globalIgnores } from 'eslint/config';
import react from 'eslint-config-zakodium/react';
import ts from 'eslint-config-zakodium/ts';
import unicorn from 'eslint-config-zakodium/unicorn';

export default defineConfig(
  globalIgnores(['coverage', 'dist', 'playwright-report', 'test-results']),
  ts,
  unicorn,
  react,
  {
    // The elucidation API speaks snake_case (`job_id`, `gens_ga`, `molecular_formula`).
    // These modules mirror the wire format exactly, and the tests assert against it.
    // Renaming would require a translation layer whose only purpose is a lint rule.
    files: [
      'src/api/**',
      'src/state/runs.ts',
      'src/components/SettingsDialog.tsx',
      'src/**/__tests__/**',
      'scripts/**',
      'e2e/**',
    ],
    rules: {
      camelcase: 'off',
      '@typescript-eslint/naming-convention': 'off',
    },
  },
);
