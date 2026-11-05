import type http from 'node:http';
import { Server } from 'socket.io';

/** Placeholder: o tempo real é implementado na fase 4. */
export function attachRealtime(server: http.Server) {
  return new Server(server);
}
