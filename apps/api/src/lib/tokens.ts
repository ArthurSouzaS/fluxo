import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

const ISSUER = 'fluxo-api';

export interface AccessTokenPayload {
  sub: string;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    issuer: ISSUER,
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

/** Retorna o id do usuário ou null se o token for inválido/expirado. */
export function verifyAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Refresh token opaco (aleatório). No banco fica apenas o hash. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/** HMAC com segredo próprio: um vazamento do banco não permite forjar tokens. */
export function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}
