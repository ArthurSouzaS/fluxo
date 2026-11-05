import type { CreateColumnInput, MoveColumnInput, UpdateColumnInput } from '@fluxo/shared';
import type { Ctx } from '../../lib/context';
import { toColumn } from '../../lib/mappers';
import { planMove } from '../../lib/ordering';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { logActivity } from '../activities/activity.logger';
import { requireBoard, requireColumn } from '../access';

export async function create(ctx: Ctx, boardId: string, input: CreateColumnInput) {
  const { board } = await requireBoard(ctx.userId, boardId, 'column:manage');
  const last = await prisma.boardColumn.findFirst({
    where: { boardId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const column = await prisma.boardColumn.create({
    data: {
      boardId,
      title: input.title,
      wipLimit: input.wipLimit ?? null,
      isDone: input.isDone ?? false,
      position: (last?.position ?? 0) + 1024,
    },
  });
  await logActivity({
    workspaceId: board.workspaceId,
    boardId,
    actorId: ctx.userId,
    type: 'column.created',
    data: { columnTitle: column.title },
  });
  const dto = toColumn(column);
  realtimeBus.publishToBoard(ctx, boardId, { type: 'column.created', column: dto });
  return dto;
}

export async function update(ctx: Ctx, columnId: string, input: UpdateColumnInput) {
  const { board, column } = await requireColumn(ctx.userId, columnId, 'column:manage');

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.boardColumn.update({ where: { id: columnId }, data: input });
    // Marcar/desmarcar a coluna como "concluída" atualiza a conclusão dos cartões dela.
    if (input.isDone !== undefined && input.isDone !== column.isDone) {
      await tx.card.updateMany({
        where: { columnId, ...(input.isDone ? { completedAt: null } : {}) },
        data: { completedAt: input.isDone ? new Date() : null },
      });
    }
    return result;
  });

  await logActivity({
    workspaceId: board.workspaceId,
    boardId: board.id,
    actorId: ctx.userId,
    type: 'column.updated',
    data: { columnTitle: updated.title },
  });
  const dto = toColumn(updated);
  realtimeBus.publishToBoard(ctx, board.id, { type: 'column.updated', column: dto });
  return dto;
}

export async function move(ctx: Ctx, columnId: string, input: MoveColumnInput) {
  const { board } = await requireColumn(ctx.userId, columnId, 'column:manage');
  const siblings = await prisma.boardColumn.findMany({
    where: { boardId: board.id, NOT: { id: columnId } },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });
  const plan = planMove(siblings, input.index);

  const updated = await prisma.$transaction(async (tx) => {
    if (plan.rebalanced) {
      for (const item of plan.rebalanced) {
        await tx.boardColumn.update({ where: { id: item.id }, data: { position: item.position } });
      }
    }
    return tx.boardColumn.update({ where: { id: columnId }, data: { position: plan.position } });
  });

  const dto = toColumn(updated);
  if (plan.rebalanced) {
    realtimeBus.publishToBoard(ctx, board.id, {
      type: 'columns.reordered',
      positions: [...plan.rebalanced, { id: dto.id, position: dto.position }],
    });
  } else {
    realtimeBus.publishToBoard(ctx, board.id, { type: 'column.updated', column: dto });
  }
  return dto;
}

/** Exclui a coluna e os cartões dela; devolve os arquivos de anexo para remoção. */
export async function remove(ctx: Ctx, columnId: string): Promise<string[]> {
  const { board, column } = await requireColumn(ctx.userId, columnId, 'column:manage');
  const attachments = await prisma.attachment.findMany({
    where: { card: { columnId } },
    select: { storedName: true },
  });
  await prisma.boardColumn.delete({ where: { id: columnId } });
  await logActivity({
    workspaceId: board.workspaceId,
    boardId: board.id,
    actorId: ctx.userId,
    type: 'column.deleted',
    data: { columnTitle: column.title },
  });
  realtimeBus.publishToBoard(ctx, board.id, { type: 'column.deleted', columnId });
  return attachments.map((attachment) => attachment.storedName);
}
