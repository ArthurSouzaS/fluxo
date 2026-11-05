import { Router } from 'express';
import { createLabelSchema, updateLabelSchema } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { toLabel } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { requireBoard, requireLabel } from '../access';

export const labelsRouter = Router();

labelsRouter.get('/boards/:boardId/labels', async (req, res) => {
  await requireBoard(ctx(req).userId, req.params.boardId);
  const labels = await prisma.label.findMany({
    where: { boardId: req.params.boardId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(labels.map(toLabel));
});

labelsRouter.post('/boards/:boardId/labels', async (req, res) => {
  const context = ctx(req);
  const input = createLabelSchema.parse(req.body);
  const { board } = await requireBoard(context.userId, req.params.boardId, 'label:manage');
  const label = toLabel(await prisma.label.create({ data: { ...input, boardId: board.id } }));
  realtimeBus.publishToBoard(context, board.id, { type: 'label.created', label });
  res.status(201).json(label);
});

labelsRouter.patch('/labels/:labelId', async (req, res) => {
  const context = ctx(req);
  const input = updateLabelSchema.parse(req.body);
  const { board } = await requireLabel(context.userId, req.params.labelId, 'label:manage');
  const label = toLabel(
    await prisma.label.update({ where: { id: req.params.labelId }, data: input }),
  );
  realtimeBus.publishToBoard(context, board.id, { type: 'label.updated', label });
  res.json(label);
});

labelsRouter.delete('/labels/:labelId', async (req, res) => {
  const context = ctx(req);
  const { board } = await requireLabel(context.userId, req.params.labelId, 'label:manage');
  await prisma.label.delete({ where: { id: req.params.labelId } });
  realtimeBus.publishToBoard(context, board.id, {
    type: 'label.deleted',
    labelId: req.params.labelId,
  });
  res.status(204).end();
});
