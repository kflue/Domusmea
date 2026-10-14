import { defineConfig } from 'vitest/config';

/** Backend and shared-code unit tests in Node (`npm run test:server`); `ng test` covers `src/app`. */
export default defineConfig({
  test: {
    include: ['src/server/**/*.spec.ts', 'src/shared/**/*.spec.ts'],
    environment: 'node',
  },
});
