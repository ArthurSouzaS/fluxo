import type { Request } from 'express';
import { SOCKET_ID_HEADER } from '@fluxo/shared';
import { unauthorized } from './errors';

/** Contexto de quem executa a ação, repassado para os services. */
export interface Ctx {
  userId: string;
  /** Socket de origem: eventos em tempo real não são ecoados para ele. */
  socketId?: string;
}

export function ctx(req: Request): Ctx {
  if (!req.userId) throw unauthorized();
  const socketId = req.header(SOCKET_ID_HEADER);
  return {
    userId: req.userId,
    socketId: socketId && socketId.length <= 64 ? socketId : undefined,
  };
}
