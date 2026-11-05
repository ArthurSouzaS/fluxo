import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/** Instância única do Prisma (reaproveitada no hot reload do tsx). */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;
