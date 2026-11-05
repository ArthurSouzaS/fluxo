'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification, NotificationList } from '@fluxo/shared';
import { notificationsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { formatRelative } from '@/lib/format';
import { Avatar } from '../ui/Avatar';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { EmptyState, ErrorState, Skeleton } from '../ui/States';
import styles from './NotificationsBell.module.scss';

const TYPE_ICON = {
  MENTION: 'at',
  ASSIGNED: 'user',
  COMMENT: 'comment',
  MEMBER_ADDED: 'users',
} as const;

/** Sino com a central de notificações. */
export function NotificationsBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => notificationsApi.list(),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onMutate: (id) => {
      queryClient.setQueryData<NotificationList>(queryKeys.notifications, (list) =>
        list
          ? {
              ...list,
              unreadCount: Math.max(
                0,
                list.unreadCount - (list.data.find((n) => n.id === id && !n.readAt) ? 1 : 0),
              ),
              data: list.data.map((n) =>
                n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
              ),
            }
          : list,
      );
    },
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = (notification: Notification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    setOpen(false);
    const { boardId, cardId, workspaceId } = notification.data;
    if (boardId) router.push(`/board?id=${boardId}${cardId ? `&card=${cardId}` : ''}`);
    else if (workspaceId) router.push(`/workspace?id=${workspaceId}`);
  };

  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <div className={styles.root} ref={rootRef}>
      <IconButton
        ref={buttonRef}
        icon="bell"
        label={unread ? `Notificações (${unread} não lidas)` : 'Notificações'}
        badge={unread}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Notificações">
          <header className={styles.header}>
            <h2 className={styles.title}>Notificações</h2>
            {unread ? (
              <Button
                size="sm"
                variant="ghost"
                icon="check"
                onClick={() => markAll.mutate()}
                loading={markAll.isPending}
              >
                Marcar todas como lidas
              </Button>
            ) : null}
          </header>
          <div className={styles.list}>
            {notifications.isPending ? (
              <div className={styles.loading}>
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : notifications.isError ? (
              <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
            ) : notifications.data.data.length === 0 ? (
              <EmptyState
                compact
                icon="bell"
                title="Tudo em dia"
                description="Menções e atribuições aparecem aqui."
              />
            ) : (
              <ul>
                {notifications.data.data.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={[styles.item, !notification.readAt && styles.unread]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => openNotification(notification)}
                    >
                      {notification.actor ? (
                        <Avatar user={notification.actor} size={30} labelled={false} />
                      ) : (
                        <span className={styles.typeIcon}>
                          <Icon name={TYPE_ICON[notification.type]} size={14} />
                        </span>
                      )}
                      <span className={styles.content}>
                        <span className={styles.message}>{notification.message}</span>
                        <span className={styles.meta}>
                          <Icon name={TYPE_ICON[notification.type]} size={12} />
                          {formatRelative(notification.createdAt)}
                        </span>
                      </span>
                      {!notification.readAt ? (
                        <span className={styles.dot} aria-label="Não lida" role="img" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
