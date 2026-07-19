import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `e2e` holds Playwright specs, which must not be collected by vitest.
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**', 'src/vite-env.d.ts'],
      provider: 'v8',
    },
    snapshotFormat: {
      maxOutputLength: Number.MAX_SAFE_INTEGER,
    },
  },
});
