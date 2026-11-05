import { Router } from 'express';
import { paginationQuerySchema } from '@fluxo/shared';
import type { Prisma } from '@prisma/client';
import { ctx } from '../../lib/context';
import { activityInclude, toActivity } from '../../lib/mappers';
import { pageArgs, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { requireBoard, requireCard } from '../access';

export const activitiesRouter = Router();

async function listActivities(where: Prisma.ActivityWhereInput, query: unknown) {
  const pagination = paginationQuerySchema.parse(query);
  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: activityInclude,
      ...pageArgs(pagination),
    }),
    prisma.activity.count({ where }),
  ]);
  return paginate(activities.map(toActivity), total, pagination);
}

activitiesRouter.get('/boards/:boardId/activities', async (req, res) => {
  await requireBoard(ctx(req).userId, req.params.boardId);
  res.json(await listActivities({ boardId: req.params.boardId }, req.query));
});

activitiesRouter.get('/cards/:cardId/activities', async (req, res) => {
  await requireCard(ctx(req).userId, req.params.cardId);
  res.json(await listActivities({ cardId: req.params.cardId }, req.query));
});
