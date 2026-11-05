import { Router } from 'express';
import {
  addMemberSchema,
  createWorkspaceSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { deleteStoredFiles } from '../attachments/storage';
import * as service from './workspaces.service';

export const workspacesRouter = Router();

workspacesRouter.get('/workspaces', async (req, res) => {
  res.json(await service.list(ctx(req)));
});

workspacesRouter.post('/workspaces', async (req, res) => {
  const input = createWorkspaceSchema.parse(req.body);
  res.status(201).json(await service.create(ctx(req), input));
});

workspacesRouter.get('/workspaces/:workspaceId', async (req, res) => {
  res.json(await service.get(ctx(req), req.params.workspaceId));
});

workspacesRouter.patch('/workspaces/:workspaceId', async (req, res) => {
  const input = updateWorkspaceSchema.parse(req.body);
  res.json(await service.update(ctx(req), req.params.workspaceId, input));
});

workspacesRouter.delete('/workspaces/:workspaceId', async (req, res) => {
  const files = await service.remove(ctx(req), req.params.workspaceId);
  await deleteStoredFiles(files);
  res.status(204).end();
});

workspacesRouter.get('/workspaces/:workspaceId/members', async (req, res) => {
  res.json(await service.listMembers(ctx(req), req.params.workspaceId));
});

workspacesRouter.post('/workspaces/:workspaceId/members', async (req, res) => {
  const input = addMemberSchema.parse(req.body);
  res.status(201).json(await service.addMember(ctx(req), req.params.workspaceId, input));
});

workspacesRouter.patch('/workspaces/:workspaceId/members/:userId', async (req, res) => {
  const input = updateMemberSchema.parse(req.body);
  res.json(await service.updateMember(ctx(req), req.params.workspaceId, req.params.userId, input));
});

workspacesRouter.delete('/workspaces/:workspaceId/members/:userId', async (req, res) => {
  await service.removeMember(ctx(req), req.params.workspaceId, req.params.userId);
  res.status(204).end();
});
