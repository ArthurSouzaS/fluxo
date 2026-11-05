import { Router } from 'express';
import { z } from 'zod';
import { createBoardSchema, updateBoardSchema } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { deleteStoredFiles } from '../attachments/storage';
import * as service from './boards.service';

export const boardsRouter = Router();

const listQuery = z.object({
  archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

boardsRouter.get('/workspaces/:workspaceId/boards', async (req, res) => {
  const { archived } = listQuery.parse(req.query);
  res.json(await service.listByWorkspace(ctx(req), req.params.workspaceId, archived));
});

boardsRouter.post('/workspaces/:workspaceId/boards', async (req, res) => {
  const input = createBoardSchema.parse(req.body);
  res.status(201).json(await service.create(ctx(req), req.params.workspaceId, input));
});

boardsRouter.get('/boards/:boardId', async (req, res) => {
  res.json(await service.getDetail(ctx(req), req.params.boardId));
});

boardsRouter.patch('/boards/:boardId', async (req, res) => {
  const input = updateBoardSchema.parse(req.body);
  res.json(await service.update(ctx(req), req.params.boardId, input));
});

boardsRouter.delete('/boards/:boardId', async (req, res) => {
  const files = await service.remove(ctx(req), req.params.boardId);
  await deleteStoredFiles(files);
  res.status(204).end();
});
