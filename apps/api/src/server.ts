import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { attachRealtime } from './realtime/socket';

const app = createApp();
const server = http.createServer(app);
const io = attachRealtime(server);

server.listen(env.PORT, () => {
  logger.info(`Fluxo API ouvindo em http://localhost:${env.PORT} (docs em /docs)`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} recebido, encerrando...`);
  io.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
