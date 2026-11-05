'use client';

import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { can, type BoardDetail, type Comment } from '@fluxo/shared';
import { cardsApi, commentsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatFullDate, formatRelative } from '@/lib/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Markdown } from '../ui/Markdown';
import { ErrorState, errorMessage, Skeleton } from '../ui/States';
import { useToast } from '../ui/Toast';
import { MentionTextarea } from './MentionTextarea';
import styles from './CardModal.module.scss';

export function CardComments({ cardId, board }: { cardId: string; board: BoardDetail }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const canComment = can(board.myRole, 'comment:create');
  const canModerate = can(board.myRole, 'comment:moderate');

  const comments = useInfiniteQuery({
    queryKey: queryKeys.cardComments(cardId),
    queryFn: ({ pageParam }) => cardsApi.comments(cardId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cardComments(cardId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.board(board.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cardActivities(cardId) });
  };

  const create = useMutation({
    mutationFn: (body: string) => cardsApi.addComment(cardId, body),
    onSuccess: () => {
      setDraft('');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => commentsApi.update(id, body),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => commentsApi.remove(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = () => {
    const body = draft.trim();
    if (body) create.mutate(body);
  };

  const list: Comment[] = comments.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className={styles.comments}>
      {canComment ? (
        <div className={styles.composer}>
          {user ? <Avatar user={user} size={30} labelled={false} /> : null}
          <div className={styles.composerBody}>
            <MentionTextarea
              label="Escrever comentário"
              value={draft}
              onChange={setDraft}
              onSubmit={submit}
              members={board.members}
              placeholder="Escreva um comentário... use @ para mencionar alguém"
            />
            <div className={styles.editorActions}>
              <Button
                size="sm"
                variant="primary"
                onClick={submit}
                loading={create.isPending}
                disabled={!draft.trim()}
              >
                Comentar
              </Button>
              <span className={styles.hint}>Ctrl+Enter envia · Markdown suportado</span>
            </div>
          </div>
        </div>
      ) : null}

      {comments.isPending ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </div>
      ) : comments.isError ? (
        <ErrorState error={comments.error} onRetry={() => comments.refetch()} />
      ) : list.length === 0 ? (
        <p className={styles.muted}>Nenhum comentário ainda.</p>
      ) : (
        <ol className={styles.commentList} aria-label="Comentários">
          {list.map((comment) => {
            const mine = comment.author.id === user?.id;
            return (
              <li key={comment.id} className={styles.comment}>
                <Avatar user={comment.author} size={30} labelled={false} />
                <div className={styles.commentBody}>
                  <p className={styles.commentMeta}>
                    <strong>{comment.author.name}</strong>
                    <time dateTime={comment.createdAt} title={formatFullDate(comment.createdAt)}>
                      {formatRelative(comment.createdAt)}
                    </time>
                    {new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() >
                    2000 ? (
                      <span>(editado)</span>
                    ) : null}
                  </p>
                  {editing?.id === comment.id ? (
                    <>
                      <MentionTextarea
                        label="Editar comentário"
                        value={editing.body}
                        onChange={(body) => setEditing({ id: comment.id, body })}
                        onSubmit={() => update.mutate(editing)}
                        members={board.members}
                      />
                      <div className={styles.editorActions}>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={update.isPending}
                          onClick={() => update.mutate(editing)}
                        >
                          Salvar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className={styles.bubble}>
                      <Markdown mentions>{comment.body}</Markdown>
                    </div>
                  )}
                  {editing?.id !== comment.id && ((mine && canComment) || canModerate) ? (
                    <div className={styles.commentActions}>
                      {mine && canComment ? (
                        <button
                          type="button"
                          onClick={() => setEditing({ id: comment.id, body: comment.body })}
                        >
                          Editar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Excluir este comentário?')) remove.mutate(comment.id);
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {comments.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          block
          onClick={() => comments.fetchNextPage()}
          loading={comments.isFetchingNextPage}
        >
          Carregar comentários anteriores
        </Button>
      ) : null}
    </div>
  );
}
