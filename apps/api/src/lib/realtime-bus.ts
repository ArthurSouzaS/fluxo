import type { BoardEvent, BoardEventEnvelope, Notification } from '@fluxo/shared';
import type { Ctx } from './context';

/**
 * Barramento entre os services e o Socket.io.
 * Os services publicam eventos aqui sem conhecer o Socket.io; o módulo de
 * tempo real se inscreve ao iniciar. Nos testes nada é inscrito (no-op).
 */
type BoardListener = (envelope: BoardEventEnvelope, exceptSocketId?: string) => void;
type UserListener = (userId: string, notification: Notification) => void;

const boardListeners = new Set<BoardListener>();
const userListeners = new Set<UserListener>();

export const realtimeBus = {
  onBoardEvent(listener: BoardListener) {
    boardListeners.add(listener);
    return () => boardListeners.delete(listener);
  },
  onNotification(listener: UserListener) {
    userListeners.add(listener);
    return () => userListeners.delete(listener);
  },
  publishToBoard(ctx: Ctx | null, boardId: string, event: BoardEvent) {
    const envelope: BoardEventEnvelope = { boardId, actorId: ctx?.userId ?? null, event };
    for (const listener of boardListeners) listener(envelope, ctx?.socketId);
  },
  publishNotification(userId: string, notification: Notification) {
    for (const listener of userListeners) listener(userId, notification);
  },
};
