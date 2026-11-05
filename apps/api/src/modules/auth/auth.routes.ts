import { Router, type RequestHandler, type Response } from 'express';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  type AuthResponse,
} from '@fluxo/shared';
import { env } from '../../config/env';
import { ctx } from '../../lib/context';
import { requireAuth } from '../../middlewares/auth';
import * as authService from './auth.service';

export const REFRESH_COOKIE = 'fluxo_refresh';
const COOKIE_PATH = '/api/auth';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: COOKIE_PATH,
  });
}

function respond(res: Response, result: authService.AuthResult, status = 200) {
  setRefreshCookie(res, result.refreshToken);
  const body: AuthResponse = { user: result.user, accessToken: result.accessToken };
  res.status(status).json(body);
}

export function authRouter(authLimiter: RequestHandler) {
  const router = Router();

  router.post('/register', authLimiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    respond(res, await authService.register(input), 201);
  });

  router.post('/login', authLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    respond(res, await authService.login(input));
  });

  router.post('/refresh', async (req, res) => {
    try {
      respond(res, await authService.refresh(req.cookies?.[REFRESH_COOKIE]));
    } catch (error) {
      clearRefreshCookie(res);
      throw error;
    }
  });

  router.post('/logout', async (req, res) => {
    await authService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.status(204).end();
  });

  router.post('/change-password', requireAuth, async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    respond(res, await authService.changePassword(ctx(req).userId, input));
  });

  return router;
}
