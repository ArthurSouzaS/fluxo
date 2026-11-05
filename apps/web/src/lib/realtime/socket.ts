'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@fluxo/shared';
import { registerSocketIdGetter, refreshSession } from '../api/client';
import { SOCKET_URL } from '../config';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;
const listeners = new Set<(socket: AppSocket | null) => void>();

registerSocketIdGetter(() => (socket?.connected ? socket.id : undefined));

export function getSocket() {
  return socket;
}

/** Notifica quando o socket é criado/destruído (para os hooks se reinscreverem). */
export function onSocketChange(listener: (socket: AppSocket | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function connectSocket(token: string) {
  if (!SOCKET_URL) return null;
  if (socket) {
    // Novo token: vale para as próximas reconexões.
    socket.auth = { token };
    return socket;
  }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  socket.on('connect_error', async (error) => {
    if (error.message !== 'UNAUTHORIZED') return;
    // Token expirado: renova e tenta de novo.
    const session = await refreshSession();
    if (session && socket) {
      socket.auth = { token: session.accessToken };
      socket.connect();
    }
  });
  for (const listener of listeners) listener(socket);
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  for (const listener of listeners) listener(null);
}
