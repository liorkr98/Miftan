import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './src/__tests__/test-env.ts';

export default defineConfig({
  test: {
    globalSetup: ['./src/__tests__/global-setup.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    /* The suite shares one Postgres database, so files must not race. */
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret-that-is-long-enough-to-pass-validation',
      WEB_ORIGIN: 'http://localhost:5178',
      COOKIE_PATH: '/auth',
    },
  },
});
