import rateLimit, { type Options } from 'express-rate-limit';

const message = (text: string) => ({ error: { code: 'TOO_MANY_REQUESTS', message: text } });

export interface RateLimitOptions {
  enabled: boolean;
}

/** Limites gerais da API e limites mais rígidos para as rotas de autenticação. */
export function createRateLimiters({ enabled }: RateLimitOptions) {
  const base: Partial<Options> = {
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !enabled,
  };

  return {
    api: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 300,
      message: message('Muitas requisições. Aguarde um minuto e tente novamente.'),
    }),
    auth: rateLimit({
      ...base,
      windowMs: 15 * 60 * 1000,
      limit: 20,
      // Logins bem-sucedidos não contam para o limite.
      skipSuccessfulRequests: true,
      message: message('Muitas tentativas de login. Tente novamente em 15 minutos.'),
    }),
    upload: rateLimit({
      ...base,
      windowMs: 60 * 1000,
      limit: 20,
      message: message('Muitos envios de arquivo. Aguarde um minuto.'),
    }),
  };
}
