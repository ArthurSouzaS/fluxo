import { Router } from 'express';
import {
  cardFiltersSchema,
  createCardSchema,
  moveCardSchema,
  setAssigneesSchema,
  setLabelsSchema,
  updateCardSchema,
} from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { deleteStoredFiles } from '../attachments/storage';
import * as service from './cards.service';

export const cardsRouter = Router();

cardsRouter.get('/boards/:boardId/cards', async (req, res) => {
  const filters = cardFiltersSchema.parse(req.query);
  res.json(await service.list(ctx(req), req.params.boardId, filters));
});

cardsRouter.post('/columns/:columnId/cards', async (req, res) => {
  const input = createCardSchema.parse(req.body);
  res.status(201).json(await service.create(ctx(req), req.params.columnId, input));
});

cardsRouter.get('/cards/:cardId', async (req, res) => {
  res.json(await service.getDetail(ctx(req), req.params.cardId));
});

cardsRouter.patch('/cards/:cardId', async (req, res) => {
  const input = updateCardSchema.parse(req.body);
  res.json(await service.update(ctx(req), req.params.cardId, input));
});

cardsRouter.post('/cards/:cardId/move', async (req, res) => {
  const input = moveCardSchema.parse(req.body);
  res.json(await service.move(ctx(req), req.params.cardId, input));
});

cardsRouter.put('/cards/:cardId/assignees', async (req, res) => {
  const input = setAssigneesSchema.parse(req.body);
  res.json(await service.setAssignees(ctx(req), req.params.cardId, input));
});

cardsRouter.put('/cards/:cardId/labels', async (req, res) => {
  const input = setLabelsSchema.parse(req.body);
  res.json(await service.setLabels(ctx(req), req.params.cardId, input));
});

cardsRouter.delete('/cards/:cardId', async (req, res) => {
  const files = await service.remove(ctx(req), req.params.cardId);
  await deleteStoredFiles(files);
  res.status(204).end();
});
