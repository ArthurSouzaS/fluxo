import { defineConfig, devices } from '@playwright/test';

/**
 * E2E com a pilha completa: PostgreSQL (banco fluxo_e2e) + API + web.
 * Portas próprias para não conflitar com o ambiente de desenvolvimento.
 */
const API_PORT = 3334;
const WEB_PORT = 3101;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/fluxo_e2e?schema=public';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      // Banco limpo e populado a cada execução.
      command:
        'pnpm exec prisma migrate deploy && pnpm exec tsx prisma/seed.ts && pnpm exec tsx src/server.ts',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_URL,
        JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789-0123456789',
        JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789-0123456789',
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        RATE_LIMIT_ENABLED: 'false',
        UPLOAD_DIR: './uploads-e2e',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/login`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
