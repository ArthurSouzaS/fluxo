import { Router } from 'express';
import {
  createChecklistItemSchema,
  createChecklistSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
} from '@fluxo/shared';
import { ctx } from '../../lib/context';
import * as service from './checklists.service';

export const checklistsRouter = Router();

checklistsRouter.post('/cards/:cardId/checklists', async (req, res) => {
  const input = createChecklistSchema.parse(req.body);
  res.status(201).json(await service.create(ctx(req), req.params.cardId, input));
});

checklistsRouter.patch('/checklists/:checklistId', async (req, res) => {
  const input = updateChecklistSchema.parse(req.body);
  res.json(await service.update(ctx(req), req.params.checklistId, input));
});

checklistsRouter.delete('/checklists/:checklistId', async (req, res) => {
  await service.remove(ctx(req), req.params.checklistId);
  res.status(204).end();
});

checklistsRouter.post('/checklists/:checklistId/items', async (req, res) => {
  const input = createChecklistItemSchema.parse(req.body);
  res.status(201).json(await service.addItem(ctx(req), req.params.checklistId, input));
});

checklistsRouter.patch('/checklist-items/:itemId', async (req, res) => {
  const input = updateChecklistItemSchema.parse(req.body);
  res.json(await service.updateItem(ctx(req), req.params.itemId, input));
});

checklistsRouter.delete('/checklist-items/:itemId', async (req, res) => {
  res.json(await service.removeItem(ctx(req), req.params.itemId));
});
