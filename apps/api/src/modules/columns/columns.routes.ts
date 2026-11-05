import { Router } from 'express';
import { createColumnSchema, moveColumnSchema, updateColumnSchema } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { deleteStoredFiles } from '../attachments/storage';
import * as service from './columns.service';

export const columnsRouter = Router();

columnsRouter.post('/boards/:boardId/columns', async (req, res) => {
  const input = createColumnSchema.parse(req.body);
  res.status(201).json(await service.create(ctx(req), req.params.boardId, input));
});

columnsRouter.patch('/columns/:columnId', async (req, res) => {
  const input = updateColumnSchema.parse(req.body);
  res.json(await service.update(ctx(req), req.params.columnId, input));
});

columnsRouter.post('/columns/:columnId/move', async (req, res) => {
  const input = moveColumnSchema.parse(req.body);
  res.json(await service.move(ctx(req), req.params.columnId, input));
});

columnsRouter.delete('/columns/:columnId', async (req, res) => {
  const files = await service.remove(ctx(req), req.params.columnId);
  await deleteStoredFiles(files);
  res.status(204).end();
});
