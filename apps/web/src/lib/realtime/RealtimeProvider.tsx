'use client';

import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Notification, NotificationList } from '@fluxo/shared';
import { useToast } from '@/components/ui/Toast';
import { getAccessToken, onSessionChange } from '../api/client';
import { queryKeys } from '../api/keys';
import { connectSocket, disconnectSocket, onSocketChange, type AppSocket } from './socket';

/** Mantém o socket conectado enquanto houver sessão e recebe notificações. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    const token = getAccessToken();
    if (token) connectSocket(token);
    const offSession = onSessionChange((session) => {
      if (session) connectSocket(session.accessToken);
      else disconnectSocket();
    });

    let current: AppSocket | null = null;
    const onNotification = (notification: Notification) => {
      queryClient.setQueryData<NotificationList>(queryKeys.notifications, (list) =>
        list
          ? {
              ...list,
              unreadCount: list.unreadCount + 1,
              data: [notification, ...list.data.filter((item) => item.id !== notification.id)],
            }
          : list,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      toast.info(notification.message);
    };
    const offSocket = onSocketChange((socket) => {
      current?.off('notification:new', onNotification);
      current = socket;
      socket?.on('notification:new', onNotification);
    });

    return () => {
      offSession();
      offSocket();
      current?.off('notification:new', onNotification);
    };
  }, [queryClient, toast]);

  return children;
}
