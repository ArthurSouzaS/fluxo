/**
 * Contrato dos eventos em tempo real (Socket.io).
 */
import type {
  BoardDetail,
  CardSummary,
  Column,
  Comment,
  Label,
  Notification,
  UserPublic,
} from './types';

export type BoardEvent =
  | {
      type: 'board.updated';
      board: Pick<BoardDetail, 'id' | 'title' | 'description' | 'color' | 'archived'>;
    }
  | { type: 'board.deleted'; boardId: string }
  | { type: 'column.created' | 'column.updated'; column: Column }
  | { type: 'column.deleted'; columnId: string }
  | { type: 'columns.reordered'; positions: Array<{ id: string; position: number }> }
  | { type: 'card.created' | 'card.updated'; card: CardSummary }
  | { type: 'card.moved'; card: CardSummary; fromColumnId: string }
  | {
      type: 'cards.reordered';
      columnId: string;
      positions: Array<{ id: string; position: number }>;
    }
  | { type: 'card.deleted'; cardId: string; columnId: string }
  | { type: 'label.created' | 'label.updated'; label: Label }
  | { type: 'label.deleted'; labelId: string }
  | { type: 'comment.created' | 'comment.updated'; comment: Comment }
  | { type: 'comment.deleted'; cardId: string; commentId: string }
  | { type: 'members.changed' };

export interface BoardEventEnvelope {
  boardId: string;
  /** Quem fez a alteração (a web resolve o nome pela lista de membros). */
  actorId: string | null;
  event: BoardEvent;
}

export interface PresencePayload {
  boardId: string;
  users: UserPublic[];
}

/** Eventos que o servidor envia ao cliente. */
export interface ServerToClientEvents {
  'board:event': (payload: BoardEventEnvelope) => void;
  'presence:update': (payload: PresencePayload) => void;
  'notification:new': (notification: Notification) => void;
}

export type JoinBoardAck = { ok: true } | { ok: false; error: string };

/** Eventos que o cliente envia ao servidor. */
export interface ClientToServerEvents {
  'board:join': (boardId: string, ack?: (result: JoinBoardAck) => void) => void;
  'board:leave': (boardId: string) => void;
}

/** Cabeçalho HTTP com o id do socket de quem fez a alteração (para não ecoar o evento). */
export const SOCKET_ID_HEADER = 'x-socket-id';
