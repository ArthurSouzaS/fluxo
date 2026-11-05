import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/global-setup.ts'],
          setupFiles: ['tests/setup.ts'],
          // Os testes de integração compartilham um único banco: rodam em série.
          fileParallelism: false,
          hookTimeout: 30000,
          testTimeout: 30000,
        },
      },
    ],
  },
});
