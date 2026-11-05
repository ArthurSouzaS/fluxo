import { afterAll, beforeEach } from 'vitest';
import { applyTestEnv } from './env';

applyTestEnv();

const { resetDatabase } = await import('./helpers');
const { prisma } = await import('../src/lib/prisma');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
