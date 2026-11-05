/** Configurações públicas da web (resolvidas no build). */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === 'true';
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/**
 * No modo demonstração a "API" é simulada pelo MSW dentro do próprio navegador,
 * em um caminho relativo ao site.
 */
export const API_URL = IS_DEMO
  ? `${BASE_PATH}/demo-api`
  : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333');

/** Socket.io conecta no mesmo endereço da API (desligado na demonstração). */
export const SOCKET_URL = IS_DEMO ? null : API_URL;
