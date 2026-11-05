'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { BoardDetail, CardDetail, CardSummary, Checklist } from '@fluxo/shared';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/components/ui/States';
import { attachmentsApi, cardsApi, checklistsApi } from './api/endpoints';
import { queryKeys } from './api/keys';

/** Ações do modal do cartão, mantendo o detalhe e o resumo no quadro sincronizados. */
export function useCardActions(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detailKey: QueryKey = queryKeys.card(cardId);

  const patchDetail = (update: (card: CardDetail) => CardDetail) =>
    queryClient.setQueryData<CardDetail>(detailKey, (card) => (card ? update(card) : card));

  const syncSummary = (summary: CardSummary) => {
    queryClient.setQueryData<BoardDetail>(queryKeys.board(boardId), (board) =>
      board
        ? { ...board, cards: board.cards.map((card) => (card.id === summary.id ? summary : card)) }
        : board,
    );
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: detailKey });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cardActivities(cardId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.board(boardId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.boardStats(boardId) });
  };

  const onError = (error: unknown) => {
    toast.error(errorMessage(error));
    refresh();
  };

  /** Substitui um checklist no detalhe (a API devolve o checklist atualizado). */
  const replaceChecklist = (checklist: Checklist) =>
    patchDetail((card) => ({
      ...card,
      checklists: card.checklists.some((c) => c.id === checklist.id)
        ? card.checklists.map((c) => (c.id === checklist.id ? checklist : c))
        : [...card.checklists, checklist],
    }));

  const setAssignees = useMutation({
    mutationFn: (userIds: string[]) => cardsApi.setAssignees(cardId, userIds),
    onSuccess: (summary) => {
      syncSummary(summary);
      refresh();
    },
    onError,
  });

  const setLabels = useMutation({
    mutationFn: (labelIds: string[]) => cardsApi.setLabels(cardId, labelIds),
    onMutate: (labelIds) => {
      const board = queryClient.getQueryData<BoardDetail>(queryKeys.board(boardId));
      patchDetail((card) => ({
        ...card,
        labelIds,
        labels: (board?.labels ?? []).filter((label) => labelIds.includes(label.id)),
      }));
    },
    onSuccess: (summary) => {
      syncSummary(summary);
      refresh();
    },
    onError,
  });

  const move = useMutation({
    mutationFn: ({ columnId, index }: { columnId: string; index: number }) =>
      cardsApi.move(cardId, columnId, index),
    onSuccess: (summary) => {
      syncSummary(summary);
      refresh();
    },
    onError,
  });

  const addChecklist = useMutation({
    mutationFn: (title: string) => cardsApi.addChecklist(cardId, title),
    onSuccess: (checklist) => {
      replaceChecklist(checklist);
      refresh();
    },
    onError,
  });

  const toggleItem = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      checklistsApi.updateItem(itemId, { done }),
    onSuccess: (checklist) => {
      replaceChecklist(checklist);
      refresh();
    },
    onError,
  });

  /** Marca/desmarca um item já no mesmo evento (checkbox controlado não "pisca"). */
  const toggleItemNow = (itemId: string, done: boolean) => {
    patchDetail((card) => ({
      ...card,
      checklists: card.checklists.map((checklist) => ({
        ...checklist,
        items: checklist.items.map((item) => (item.id === itemId ? { ...item, done } : item)),
      })),
    }));
    toggleItem.mutate({ itemId, done });
  };

  const useChecklistMutation = <T>(fn: (input: T) => Promise<Checklist | void>) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (checklist) => {
        if (checklist) replaceChecklist(checklist);
        refresh();
      },
      onError,
    });

  const addItem = useChecklistMutation(
    ({ checklistId, text }: { checklistId: string; text: string }) =>
      checklistsApi.addItem(checklistId, text),
  );
  const editItem = useChecklistMutation(({ itemId, text }: { itemId: string; text: string }) =>
    checklistsApi.updateItem(itemId, { text }),
  );
  const removeItem = useChecklistMutation((itemId: string) => checklistsApi.removeItem(itemId));
  const removeChecklist = useMutation({
    mutationFn: (checklistId: string) => checklistsApi.remove(checklistId),
    onMutate: (checklistId) =>
      patchDetail((card) => ({
        ...card,
        checklists: card.checklists.filter((c) => c.id !== checklistId),
      })),
    onSuccess: refresh,
    onError,
  });

  const upload = useMutation({
    mutationFn: (file: File) => cardsApi.upload(cardId, file),
    onSuccess: (attachment) => {
      patchDetail((card) => ({ ...card, attachments: [attachment, ...card.attachments] }));
      toast.success(`"${attachment.fileName}" anexado`);
      refresh();
    },
    onError,
  });

  const removeAttachment = useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.remove(attachmentId),
    onMutate: (attachmentId) =>
      patchDetail((card) => ({
        ...card,
        attachments: card.attachments.filter((a) => a.id !== attachmentId),
      })),
    onSuccess: refresh,
    onError,
  });

  return {
    setAssignees,
    setLabels,
    move,
    addChecklist,
    toggleItem: toggleItemNow,
    addItem,
    editItem,
    removeItem,
    removeChecklist,
    upload,
    removeAttachment,
    refresh,
  };
}
