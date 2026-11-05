import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';

/** Exige um access token válido no cabeçalho Authorization: Bearer <token>. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('Token de acesso ausente', 'TOKEN_MISSING'));
  }
  const userId = verifyAccessToken(header.slice('Bearer '.length).trim());
  if (!userId) {
    return next(unauthorized('Token de acesso inválido ou expirado', 'TOKEN_INVALID'));
  }
  req.userId = userId;
  next();
}
