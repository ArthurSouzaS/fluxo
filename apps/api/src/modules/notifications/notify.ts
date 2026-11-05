import type { NotificationKind } from '@fluxo/shared';
import type { Prisma } from '@prisma/client';
import { notificationInclude, toNotification } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';

export interface NewNotification {
  userId: string;
  actorId: string;
  type: NotificationKind;
  message: string;
  data: { workspaceId?: string; boardId?: string; cardId?: string; commentId?: string };
}

/** Cria notificações (nunca para quem fez a ação) e as envia em tempo real. */
export async function notify(items: NewNotification[]) {
  for (const item of items) {
    if (item.userId === item.actorId) continue;
    const created = await prisma.notification.create({
      data: { ...item, data: item.data as Prisma.InputJsonValue },
      include: notificationInclude,
    });
    realtimeBus.publishNotification(item.userId, toNotification(created));
  }
}
