import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'Use o formato 15m, 1h, 7d...')
    .default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_MB: z.coerce.number().positive().max(100).default(10),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  /**
   * Quantos proxies confiáveis existem na frente da API (ex.: 1 atrás de Nginx/Render).
   * Com 0, o IP do cliente vem da conexão — evita burlar o rate limit forjando X-Forwarded-For.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  isProduction: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  /** Por padrão o rate limit fica ligado, exceto nos testes automatizados. */
  rateLimitEnabled: data.RATE_LIMIT_ENABLED ?? data.NODE_ENV !== 'test',
  /** Custo do bcrypt: menor nos testes para acelerar. */
  bcryptRounds: data.BCRYPT_ROUNDS ?? (data.NODE_ENV === 'test' ? 4 : 10),
  logLevel: data.LOG_LEVEL ?? (data.NODE_ENV === 'test' ? 'silent' : 'info'),
};

export type Env = typeof env;
