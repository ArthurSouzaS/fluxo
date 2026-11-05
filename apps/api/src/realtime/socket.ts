/**
 * Tempo real com Socket.io.
 *
 * Salas:
 * - `board:<id>`: quem está com o quadro aberto (eventos do quadro + presença);
 * - `user:<id>`: todas as abas do usuário (notificações).
 *
 * Os services publicam no `realtimeBus`; aqui os eventos são repassados para
 * as salas, sem ecoar para o socket que originou a alteração.
 */
import type http from 'node:http';
import { Server, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  PresencePayload,
  ServerToClientEvents,
  UserPublic,
} from '@fluxo/shared';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { toUserPublic, userPublicSelect } from '../lib/mappers';
import { prisma } from '../lib/prisma';
import { realtimeBus } from '../lib/realtime-bus';
import { verifyAccessToken } from '../lib/tokens';
import { getRole, requireBoard } from '../modules/access';

interface SocketData {
  user: UserPublic;
}

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const boardRoom = (boardId: string) => `board:${boardId}`;
const userRoom = (userId: string) => `user:${userId}`;

/** Limite de quadros abertos ao mesmo tempo por conexão (evita abuso). */
const MAX_BOARDS_PER_SOCKET = 20;

export function attachRealtime(server: http.Server) {
  const io: IoServer = new Server(server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
    serveClient: false,
  });

  /** boardId → (socketId → usuário). */
  const presence = new Map<string, Map<string, UserPublic>>();

  function presencePayload(boardId: string): PresencePayload {
    const unique = new Map<string, UserPublic>();
    for (const user of presence.get(boardId)?.values() ?? []) unique.set(user.id, user);
    return { boardId, users: [...unique.values()] };
  }

  function leaveBoard(socket: IoSocket, boardId: string) {
    socket.leave(boardRoom(boardId));
    const sockets = presence.get(boardId);
    if (!sockets?.delete(socket.id)) return;
    if (sockets.size === 0) presence.delete(boardId);
    io.to(boardRoom(boardId)).emit('presence:update', presencePayload(boardId));
  }

  /** Após mudanças de membros, tira da sala quem perdeu acesso ao quadro. */
  async function revalidateRoom(boardId: string) {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true },
    });
    const sockets = await io.in(boardRoom(boardId)).fetchSockets();
    for (const remote of sockets) {
      const role = board ? await getRole(remote.data.user.id, board.workspaceId) : null;
      if (role) continue;
      const local = io.sockets.sockets.get(remote.id);
      if (local) leaveBoard(local, boardId);
      else remote.leave(boardRoom(boardId));
    }
  }

  // Autenticação no handshake: { auth: { token: '<access token>' } }.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const userId = typeof token === 'string' ? verifyAccessToken(token) : null;
    if (!userId) return next(new Error('UNAUTHORIZED'));
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userPublicSelect });
    if (!user) return next(new Error('UNAUTHORIZED'));
    socket.data.user = toUserPublic(user);
    next();
  });

  io.on('connection', (socket: IoSocket) => {
    const { user } = socket.data;
    socket.join(userRoom(user.id));

    socket.on('board:join', async (boardId, ack) => {
      try {
        if (typeof boardId !== 'string' || boardId.length > 64) throw new Error('INVALID');
        const joined = [...socket.rooms].filter((room) => room.startsWith('board:')).length;
        if (joined >= MAX_BOARDS_PER_SOCKET) throw new Error('TOO_MANY_BOARDS');
        await requireBoard(user.id, boardId);
        await socket.join(boardRoom(boardId));
        const sockets = presence.get(boardId) ?? new Map<string, UserPublic>();
        sockets.set(socket.id, user);
        presence.set(boardId, sockets);
        io.to(boardRoom(boardId)).emit('presence:update', presencePayload(boardId));
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'Quadro não encontrado' });
      }
    });

    socket.on('board:leave', (boardId) => {
      if (typeof boardId === 'string') leaveBoard(socket, boardId);
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('board:')) leaveBoard(socket, room.slice('board:'.length));
      }
    });
  });

  const offBoard = realtimeBus.onBoardEvent((envelope, exceptSocketId) => {
    const room = boardRoom(envelope.boardId);
    const target = exceptSocketId ? io.to(room).except(exceptSocketId) : io.to(room);
    target.emit('board:event', envelope);

    if (envelope.event.type === 'board.deleted') {
      io.in(room).socketsLeave(room);
      presence.delete(envelope.boardId);
    }
    if (envelope.event.type === 'members.changed') {
      revalidateRoom(envelope.boardId).catch((error) =>
        logger.warn({ error }, 'Falha ao revalidar sala do quadro'),
      );
    }
  });

  const offNotification = realtimeBus.onNotification((userId, notification) => {
    io.to(userRoom(userId)).emit('notification:new', notification);
  });

  return {
    io,
    /** Encerra as conexões e cancela as inscrições no barramento. */
    close: async () => {
      offBoard();
      offNotification();
      await io.close();
    },
  };
}
