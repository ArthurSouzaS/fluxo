import { Router } from 'express';
import { notificationsQuerySchema, type NotificationList } from '@fluxo/shared';
import type { Prisma } from '@prisma/client';
import { ctx } from '../../lib/context';
import { notFound } from '../../lib/errors';
import { notificationInclude, toNotification } from '../../lib/mappers';
import { pageArgs, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', async (req, res) => {
  const { userId } = ctx(req);
  const query = notificationsQuerySchema.parse(req.query);
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unread ? { readAt: null } : {}),
  };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: notificationInclude,
      ...pageArgs(query),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const body: NotificationList = {
    ...paginate(items.map(toNotification), total, query),
    unreadCount,
  };
  res.json(body);
});

notificationsRouter.post('/notifications/read-all', async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId: ctx(req).userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ updated: count });
});

notificationsRouter.post('/notifications/:notificationId/read', async (req, res) => {
  const { userId } = ctx(req);
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.notificationId, userId },
  });
  if (!notification) throw notFound('Notificação não encontrada');
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date() },
    include: notificationInclude,
  });
  res.json(toNotification(updated));
});
