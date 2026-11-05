/**
 * Cliente HTTP da web.
 * - access token só em memória (nunca em localStorage);
 * - refresh token em cookie httpOnly (enviado com credentials: 'include');
 * - em 401 por token expirado, renova uma única vez (single-flight) e repete.
 */
import type { ApiErrorBody, AuthResponse } from '@fluxo/shared';
import { SOCKET_ID_HEADER } from '@fluxo/shared';
import { API_URL } from '../config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Mensagem do campo (para formulários). */
  fieldError(path: string) {
    return this.details.find((detail) => detail.path === path)?.message;
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
let socketIdGetter: () => string | undefined = () => undefined;
const sessionListeners = new Set<(session: AuthResponse | null) => void>();

export function getAccessToken() {
  return accessToken;
}

/**
 * Marca (sem dados sensíveis) de que existe uma sessão neste navegador.
 * Evita uma chamada de renovação inútil (e um 401 no console) para visitantes.
 */
const SESSION_HINT_KEY = 'fluxo:has-session';

export function hasSessionHint() {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return true;
  }
}

export function setSession(session: AuthResponse | null) {
  accessToken = session?.accessToken ?? null;
  try {
    if (session) localStorage.setItem(SESSION_HINT_KEY, '1');
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Armazenamento indisponível: segue sem a dica.
  }
  for (const listener of sessionListeners) listener(session);
}

/** Avisa quando a sessão muda (login, renovação, expiração). */
export function onSessionChange(listener: (session: AuthResponse | null) => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/** O módulo de tempo real informa o id do socket para não receber o eco das próprias ações. */
export function registerSocketIdGetter(getter: () => string | undefined) {
  socketIdGetter = getter;
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(response.status, 'UNKNOWN', 'Não foi possível completar a requisição');
  }
}

/** Renova o access token usando o cookie de refresh. Retorna null se a sessão acabou. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setSession(null);
        return null;
      }
      const session = (await response.json()) as AuthResponse;
      setSession(session);
      return session;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

let restoring: Promise<AuthResponse | null> | null = null;

/**
 * Restaura a sessão (uma única vez por carregamento). Chamada durante a
 * renderização do AuthProvider, antes de qualquer consulta dos componentes
 * filhos — que aguardam essa promessa em vez de receber 401.
 */
export function restoreSessionOnce(): Promise<AuthResponse | null> {
  restoring ??= hasSessionHint() ? refreshSession() : Promise.resolve(null);
  return restoring;
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Devolve a Response crua (downloads). */
  raw?: boolean;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${API_URL}/api${path}`, globalThis.location?.origin ?? 'http://localhost');
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) url.searchParams.set(key, value.join(','));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
  retried = false,
): Promise<T> {
  if (!accessToken && restoring && !path.startsWith('/auth/')) await restoring;
  const headers: Record<string, string> = {};
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const socketId = socketIdGetter();
  if (socketId) headers[SOCKET_ID_HEADER] = socketId;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      signal: options.signal,
      body:
        options.body === undefined
          ? undefined
          : isForm
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Sem conexão com o servidor. Tente novamente.');
  }

  if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
    const session = await refreshSession();
    if (session) return request<T>(path, options, true);
  }

  if (!response.ok) throw await parseError(response);
  if (options.raw) return response as T;
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
