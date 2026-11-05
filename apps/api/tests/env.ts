/**
 * Variáveis de ambiente dos testes. Por segurança, só roda em bancos cujo
 * nome contenha "test" — os testes apagam todas as tabelas.
 */
import os from 'node:os';
import path from 'node:path';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/fluxo_test?schema=public';

export function applyTestEnv() {
  if (!new URL(TEST_DATABASE_URL).pathname.includes('test')) {
    throw new Error(`Banco de testes inválido (o nome deve conter "test"): ${TEST_DATABASE_URL}`);
  }
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789-0123456789',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789-0123456789',
    CORS_ORIGIN: 'http://localhost:3000',
    UPLOAD_DIR: path.join(os.tmpdir(), 'fluxo-test-uploads'),
    UPLOAD_MAX_MB: '1',
  });
}
