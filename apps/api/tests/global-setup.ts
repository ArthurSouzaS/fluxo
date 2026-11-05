import { execSync } from 'node:child_process';
import { applyTestEnv } from './env';

/** Aplica as migrations no banco de testes antes da suíte. */
export default function globalSetup() {
  applyTestEnv();
  execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe', env: process.env });
}
