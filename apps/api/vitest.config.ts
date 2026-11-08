import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/__tests__/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-long-enough-to-pass-validation',
      WEB_ORIGIN: 'http://localhost:5178',
      COOKIE_PATH: '/auth',
    },
  },
});
