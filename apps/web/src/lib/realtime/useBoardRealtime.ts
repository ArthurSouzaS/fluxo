'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BoardDetail, BoardEventEnvelope, PresencePayload, UserPublic } from '@fluxo/shared';
import { queryKeys } from '../api/keys';
import { IS_DEMO } from '../config';
import { applyBoardEvent } from '../board-state';
import { getSocket, onSocketChange, type AppSocket } from './socket';

/**
 * Entra na sala do quadro, aplica no cache os eventos dos outros usuários
 * e devolve quem está online.
 */
export function useBoardRealtime(boardId: string | null, onDeleted?: () => void) {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState<UserPublic[]>([]);
  const [socket, setSocket] = useState<AppSocket | null>(() => getSocket());

  useEffect(() => onSocketChange(setSocket), []);

  // Na demonstração não há servidor de tempo real: simula colegas online.
  useEffect(() => {
    if (!IS_DEMO || !boardId) return;
    const board = queryClient.getQueryData<BoardDetail>(queryKeys.board(boardId));
    const timer = setTimeout(() => {
      const current = queryClient.getQueryData<BoardDetail>(queryKeys.board(boardId)) ?? board;
      setOnline((current?.members ?? []).slice(0, 3).map((member) => member.user));
    }, 600);
    return () => clearTimeout(timer);
  }, [boardId, queryClient]);

  useEffect(() => {
    if (!boardId || !socket) return;

    const join = () => socket.emit('board:join', boardId);
    const onEvent = ({ boardId: eventBoardId, event }: BoardEventEnvelope) => {
      if (eventBoardId !== boardId) return;
      const current = queryClient.getQueryData<BoardDetail>(queryKeys.board(boardId));
      if (current) {
        const result = applyBoardEvent(current, event);
        if ('action' in result) {
          if (result.action === 'deleted') onDeleted?.();
          else void queryClient.invalidateQueries({ queryKey: queryKeys.board(boardId) });
        } else {
          queryClient.setQueryData(queryKeys.board(boardId), result);
        }
      }
      // Detalhes do cartão aberto e estatísticas ficam desatualizados.
      const cardId =
        'card' in event
          ? event.card.id
          : 'comment' in event
            ? event.comment.cardId
            : 'cardId' in event
              ? event.cardId
              : null;
      if (cardId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.card(cardId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cardActivities(cardId) });
        if (event.type.startsWith('comment.')) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.cardComments(cardId) });
        }
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardStats(boardId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardActivities(boardId) });
    };
    const onPresence = (payload: PresencePayload) => {
      if (payload.boardId === boardId) setOnline(payload.users);
    };

    socket.on('board:event', onEvent);
    socket.on('presence:update', onPresence);
    socket.on('connect', join);
    if (socket.connected) join();

    return () => {
      socket.off('board:event', onEvent);
      socket.off('presence:update', onPresence);
      socket.off('connect', join);
      socket.emit('board:leave', boardId);
      setOnline([]);
    };
  }, [boardId, socket, queryClient, onDeleted]);

  return online;
}
