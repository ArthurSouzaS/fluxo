'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BoardDetail,
  CardSummary,
  CreateCardInput,
  UpdateBoardInput,
  UpdateColumnInput,
} from '@fluxo/shared';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/components/ui/States';
import { boardsApi, cardsApi, columnsApi } from './api/endpoints';
import { queryKeys } from './api/keys';
import { moveCardLocally, moveColumnLocally } from './board-state';

/**
 * Mutações do quadro com atualização otimista: a interface muda na hora,
 * a requisição vai em seguida e, se falhar, o estado anterior volta.
 */
export function useBoardMutations(boardId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = queryKeys.board(boardId);

  async function optimistic(update: (board: BoardDetail) => BoardDetail) {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<BoardDetail>(key);
    if (previous) queryClient.setQueryData(key, update(previous));
    return { previous };
  }

  function rollback(error: unknown, _vars: unknown, context?: { previous?: BoardDetail }) {
    if (context?.previous) queryClient.setQueryData(key, context.previous);
    toast.error(errorMessage(error));
  }

  function mergeCard(card: CardSummary) {
    queryClient.setQueryData<BoardDetail>(key, (board) =>
      board
        ? {
            ...board,
            cards: card.archived
              ? board.cards.filter((entry) => entry.id !== card.id)
              : board.cards.some((entry) => entry.id === card.id)
                ? board.cards.map((entry) => (entry.id === card.id ? card : entry))
                : [...board.cards, card],
          }
        : board,
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.boardStats(boardId) });
  }

  const moveCard = useMutation({
    mutationFn: ({
      cardId,
      columnId,
      index,
    }: {
      cardId: string;
      columnId: string;
      index: number;
    }) => cardsApi.move(cardId, columnId, index),
    onMutate: ({ cardId, columnId, index }) =>
      optimistic((board) => moveCardLocally(board, cardId, columnId, index)),
    onError: rollback,
    onSuccess: (card) => {
      mergeCard(card);
      void queryClient.invalidateQueries({ queryKey: queryKeys.card(card.id) });
    },
  });

  const moveColumn = useMutation({
    mutationFn: ({ columnId, index }: { columnId: string; index: number }) =>
      columnsApi.move(columnId, index),
    onMutate: ({ columnId, index }) =>
      optimistic((board) => moveColumnLocally(board, columnId, index)),
    onError: rollback,
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const createCard = useMutation({
    mutationFn: ({ columnId, input }: { columnId: string; input: CreateCardInput }) =>
      cardsApi.create(columnId, input),
    onMutate: ({ columnId, input }) =>
      optimistic((board) => {
        const last = board.cards
          .filter((card) => card.columnId === columnId)
          .reduce((max, card) => Math.max(max, card.position), 0);
        const now = new Date().toISOString();
        const temp: CardSummary = {
          id: `temp-${Math.random().toString(36).slice(2)}`,
          boardId,
          columnId,
          title: input.title,
          position: last + 1024,
          dueDate: null,
          completedAt: null,
          archived: false,
          hasDescription: false,
          labelIds: [],
          assigneeIds: [],
          commentCount: 0,
          attachmentCount: 0,
          checklist: { done: 0, total: 0 },
          createdAt: now,
          updatedAt: now,
        };
        return { ...board, cards: [...board.cards, temp] };
      }),
    onError: rollback,
    onSuccess: (card) => {
      queryClient.setQueryData<BoardDetail>(key, (board) =>
        board
          ? {
              ...board,
              cards: [...board.cards.filter((entry) => !entry.id.startsWith('temp-')), card],
            }
          : board,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.boardStats(boardId) });
    },
  });

  const updateCard = useMutation({
    mutationFn: ({
      cardId,
      input,
    }: {
      cardId: string;
      input: Parameters<typeof cardsApi.update>[1];
    }) => cardsApi.update(cardId, input),
    onMutate: ({ cardId, input }) =>
      optimistic((board) => ({
        ...board,
        cards: input.archived
          ? board.cards.filter((card) => card.id !== cardId)
          : board.cards.map((card) =>
              card.id === cardId
                ? {
                    ...card,
                    ...(input.title !== undefined ? { title: input.title } : {}),
                    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
                    ...(input.description !== undefined
                      ? { hasDescription: input.description.trim().length > 0 }
                      : {}),
                  }
                : card,
            ),
      })),
    onError: rollback,
    onSuccess: (card) => {
      mergeCard(card);
      void queryClient.invalidateQueries({ queryKey: queryKeys.card(card.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cardActivities(card.id) });
    },
  });

  const createColumn = useMutation({
    mutationFn: (title: string) => columnsApi.create(boardId, { title }),
    onSuccess: (column) => {
      queryClient.setQueryData<BoardDetail>(key, (board) =>
        board && !board.columns.some((entry) => entry.id === column.id)
          ? { ...board, columns: [...board.columns, column] }
          : board,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const updateColumn = useMutation({
    mutationFn: ({ columnId, input }: { columnId: string; input: UpdateColumnInput }) =>
      columnsApi.update(columnId, input),
    onMutate: ({ columnId, input }) =>
      optimistic((board) => ({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                ...input,
                wipLimit: input.wipLimit === undefined ? column.wipLimit : (input.wipLimit ?? null),
              }
            : column,
        ),
      })),
    onError: rollback,
    onSettled: (_data, _error, { input }) => {
      // Marcar como concluída muda a conclusão dos cartões: recarrega.
      if (input.isDone !== undefined) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const deleteColumn = useMutation({
    mutationFn: (columnId: string) => columnsApi.remove(columnId),
    onMutate: (columnId) =>
      optimistic((board) => ({
        ...board,
        columns: board.columns.filter((column) => column.id !== columnId),
        cards: board.cards.filter((card) => card.columnId !== columnId),
      })),
    onError: rollback,
    onSuccess: () => toast.success('Coluna excluída'),
  });

  const updateBoard = useMutation({
    mutationFn: (input: UpdateBoardInput) => boardsApi.update(boardId, input),
    onMutate: (input) => optimistic((board) => ({ ...board, ...input })),
    onError: rollback,
    onSuccess: (board) => {
      queryClient.setQueryData(key, board);
      void queryClient.invalidateQueries({ queryKey: ['boards', board.workspaceId] });
    },
  });

  return {
    moveCard,
    moveColumn,
    createCard,
    updateCard,
    createColumn,
    updateColumn,
    deleteColumn,
    updateBoard,
    mergeCard,
  };
}
