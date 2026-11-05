import { tmpdir } from 'node:os';

// Variáveis mínimas para os testes unitários (o Prisma é simulado, não há banco).
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unit:unit@localhost:5432/unit_test',
  JWT_ACCESS_SECRET: 'unit-access-secret-0123456789-0123456789',
  JWT_REFRESH_SECRET: 'unit-refresh-secret-0123456789-0123456789',
  UPLOAD_DIR: `${tmpdir()}/fluxo-unit-uploads`,
});
