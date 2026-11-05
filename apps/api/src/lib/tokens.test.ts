import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens';

describe('tokens', () => {
  it('assina e verifica o access token', () => {
    expect(verifyAccessToken(signAccessToken('user-1'))).toBe('user-1');
  });

  it('recusa token com outro segredo, outro emissor ou algoritmo "none"', () => {
    expect(
      verifyAccessToken(
        jwt.sign({ sub: 'x' }, 'outro-segredo-qualquer-0123456789-abcdef', { issuer: 'fluxo-api' }),
      ),
    ).toBeNull();
    expect(
      verifyAccessToken(
        jwt.sign({ sub: 'x' }, process.env.JWT_ACCESS_SECRET!, { issuer: 'outro' }),
      ),
    ).toBeNull();
    expect(verifyAccessToken(jwt.sign({ sub: 'x' }, '', { algorithm: 'none' }))).toBeNull();
    expect(verifyAccessToken('lixo')).toBeNull();
  });

  it('gera refresh tokens aleatórios e hash determinístico', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
    expect(hashRefreshToken(a)).toBe(hashRefreshToken(a));
    expect(hashRefreshToken(a)).not.toBe(a);
  });
});
