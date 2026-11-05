import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { SOCKET_ID_HEADER } from '@fluxo/shared';
import { env } from './config/env';
import { buildOpenApiDocument } from './docs/openapi';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { requireAuth } from './middlewares/auth';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { createRateLimiters } from './middlewares/rate-limit';
import { activitiesRouter } from './modules/activities/activities.routes';
import { attachmentsRouter } from './modules/attachments/attachments.routes';
import { authRouter } from './modules/auth/auth.routes';
import { boardsRouter } from './modules/boards/boards.routes';
import { cardsRouter } from './modules/cards/cards.routes';
import { checklistsRouter } from './modules/checklists/checklists.routes';
import { columnsRouter } from './modules/columns/columns.routes';
import { commentsRouter } from './modules/comments/comments.routes';
import { labelsRouter } from './modules/labels/labels.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { searchRouter } from './modules/search/search.routes';
import { statsRouter } from './modules/stats/stats.routes';
import { usersRouter } from './modules/users/users.routes';
import { workspacesRouter } from './modules/workspaces/workspaces.routes';

export interface AppOptions {
  rateLimit?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const limiters = createRateLimiters({ enabled: options.rateLimit ?? env.rateLimitEnabled });

  app.disable('x-powered-by');
  app.set('trust proxy', env.isProduction ? 1 : false);

  // Sem HTTPS (desenvolvimento/Docker local), não force upgrade de requisições.
  const httpsOnly = env.COOKIE_SECURE;
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      strictTransportSecurity: httpsOnly,
      contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: httpsOnly ? [] : null },
      },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', SOCKET_ID_HEADER],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: { ignore: (req) => req.url === '/api/health' },
        serializers: {
          req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }

  // Documentação (Swagger UI precisa de scripts/estilos próprios: CSP mais flexível só aqui).
  const openApi = buildOpenApiDocument();
  app.get('/docs.json', (_req, res) => {
    res.json(openApi);
  });
  app.use(
    '/docs',
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: httpsOnly ? [] : null,
      },
    }),
    swaggerUi.serve,
    swaggerUi.setup(openApi, {
      customSiteTitle: 'Fluxo API — Documentação',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.get('/', (_req, res) => {
    res.redirect('/docs');
  });

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  const api = Router();
  api.use(limiters.api);
  api.use('/auth', authRouter(limiters.auth));

  const protectedRoutes = Router();
  protectedRoutes.use(requireAuth);
  protectedRoutes.use(
    usersRouter,
    workspacesRouter,
    boardsRouter,
    columnsRouter,
    cardsRouter,
    labelsRouter,
    checklistsRouter,
    commentsRouter,
    attachmentsRouter(limiters.upload),
    activitiesRouter,
    notificationsRouter,
    searchRouter,
    statsRouter,
  );
  api.use(protectedRoutes);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
