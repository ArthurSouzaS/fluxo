import { Router } from 'express';
import { commentBodySchema, paginationQuerySchema } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import * as service from './comments.service';

export const commentsRouter = Router();

commentsRouter.get('/cards/:cardId/comments', async (req, res) => {
  const query = paginationQuerySchema.parse(req.query);
  res.json(await service.list(ctx(req), req.params.cardId, query));
});

commentsRouter.post('/cards/:cardId/comments', async (req, res) => {
  const input = commentBodySchema.parse(req.body);
  res.status(201).json(await service.create(ctx(req), req.params.cardId, input));
});

commentsRouter.patch('/comments/:commentId', async (req, res) => {
  const input = commentBodySchema.parse(req.body);
  res.json(await service.update(ctx(req), req.params.commentId, input));
});

commentsRouter.delete('/comments/:commentId', async (req, res) => {
  await service.remove(ctx(req), req.params.commentId);
  res.status(204).end();
});
