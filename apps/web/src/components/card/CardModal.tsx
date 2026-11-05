'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { can, type BoardDetail } from '@fluxo/shared';
import { cardsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { useBoardMutations } from '@/lib/useBoardMutations';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { ErrorState, errorMessage, Skeleton } from '../ui/States';
import { useToast } from '../ui/Toast';
import { CardActivity } from './CardActivity';
import { CardAttachments } from './CardAttachments';
import { CardChecklists } from './CardChecklists';
import { CardComments } from './CardComments';
import { CardDescription } from './CardDescription';
import { CardSidebar } from './CardSidebar';
import styles from './CardModal.module.scss';

interface CardModalProps {
  cardId: string;
  board: BoardDetail;
  onClose: () => void;
}

export function CardModal({ cardId, board, onClose }: CardModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { updateCard } = useBoardMutations(board.id);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canEdit = can(board.myRole, 'card:write');

  const router = useRouter();
  const card = useQuery({ queryKey: queryKeys.card(cardId), queryFn: () => cardsApi.get(cardId) });

  // Link de um cartão de outro quadro: abre no quadro certo.
  const otherBoardId = card.data && card.data.boardId !== board.id ? card.data.boardId : null;
  useEffect(() => {
    if (otherBoardId) router.replace(`/board?id=${otherBoardId}&card=${cardId}`);
  }, [otherBoardId, cardId, router]);
  const [title, setTitle] = useState('');
  useEffect(() => {
    if (card.data) setTitle(card.data.title);
  }, [card.data?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useMutation({
    mutationFn: () => cardsApi.remove(cardId),
    onSuccess: () => {
      queryClient.setQueryData<BoardDetail>(queryKeys.board(board.id), (current) =>
        current
          ? { ...current, cards: current.cards.filter((entry) => entry.id !== cardId) }
          : current,
      );
      queryClient.removeQueries({ queryKey: queryKeys.card(cardId) });
      toast.success('Cartão excluído');
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!card.data) return;
    if (!trimmed) return setTitle(card.data.title);
    if (trimmed !== card.data.title) updateCard.mutate({ cardId, input: { title: trimmed } });
  };

  const fallbackTitle = board.cards.find((entry) => entry.id === cardId)?.title ?? 'Cartão';

  return (
    <Modal open onClose={onClose} title={card.data?.title ?? fallbackTitle} hideTitle size="xl">
      {card.isPending ? (
        <div className={styles.loading} aria-busy="true">
          <Skeleton height={32} width="60%" />
          <Skeleton height={120} />
          <Skeleton height={80} />
        </div>
      ) : card.isError ? (
        <ErrorState error={card.error} onRetry={() => card.refetch()} />
      ) : (
        <div className={styles.layout}>
          <div className={styles.main}>
            <div className={styles.titleRow}>
              <Icon name="board" size={20} className={styles.titleIcon} />
              <div className={styles.titleWrap}>
                {canEdit ? (
                  <textarea
                    className={styles.titleInput}
                    aria-label="Título do cartão"
                    value={title}
                    maxLength={200}
                    rows={1}
                    onChange={(event) => setTitle(event.target.value.replace(/\n/g, ''))}
                    onBlur={saveTitle}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <p className={styles.titleText}>{card.data.title}</p>
                )}
                <p className={styles.inColumn}>
                  na coluna <strong>{card.data.columnTitle}</strong>
                  {card.data.completedAt ? (
                    <span className={styles.doneBadge}>
                      <Icon name="check" size={12} /> Concluído
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <CardDescription
              value={card.data.description}
              canEdit={canEdit}
              saving={updateCard.isPending}
              onSave={(description) => updateCard.mutate({ cardId, input: { description } })}
            />
            <CardChecklists card={card.data} boardId={board.id} canEdit={canEdit} />
            <CardAttachments card={card.data} board={board} />

            <section className={styles.section}>
              <div role="tablist" aria-label="Comentários e histórico" className={styles.tabs}>
                <button
                  type="button"
                  role="tab"
                  id="tab-comments"
                  aria-controls="panel-comments"
                  aria-selected={tab === 'comments'}
                  onClick={() => setTab('comments')}
                >
                  <Icon name="comment" size={14} /> Comentários ({card.data.commentCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-activity"
                  aria-controls="panel-activity"
                  aria-selected={tab === 'activity'}
                  onClick={() => setTab('activity')}
                >
                  <Icon name="activity" size={14} /> Histórico
                </button>
              </div>
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === 'comments' ? (
                  <CardComments cardId={cardId} board={board} />
                ) : (
                  <CardActivity cardId={cardId} />
                )}
              </div>
            </section>
          </div>

          <CardSidebar
            card={card.data}
            board={board}
            onRequestDelete={() => setConfirmDelete(true)}
            onArchived={onClose}
          />
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Excluir cartão?"
        description="O cartão, os comentários e os anexos serão excluídos permanentemente. Para guardar, prefira arquivar."
        confirmLabel="Excluir cartão"
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </Modal>
  );
}
