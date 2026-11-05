import type { Prisma } from '@prisma/client';
import type {
  CardDetail,
  CardFilters,
  CreateCardInput,
  MoveCardInput,
  SetAssigneesInput,
  SetLabelsInput,
  UpdateCardInput,
} from '@fluxo/shared';
import type { Ctx } from '../../lib/context';
import { badRequest, notFound } from '../../lib/errors';
import {
  attachmentInclude,
  cardSummaryInclude,
  toAttachment,
  toCardSummary,
  toLabel,
  toUserPublic,
  userPublicSelect,
} from '../../lib/mappers';
import { planMove } from '../../lib/ordering';
import { pageArgs, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { logActivity } from '../activities/activity.logger';
import { requireBoard, requireCard, requireColumn } from '../access';
import { notify } from '../notifications/notify';
import { loadCardSummary } from './card-summary';

const DAY = 24 * 60 * 60 * 1000;

async function actorName(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? 'Alguém';
}

/** Garante que todos os ids informados são membros do workspace. */
async function assertMembers(workspaceId: string, userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return unique;
  const count = await prisma.workspaceMember.count({
    where: { workspaceId, userId: { in: unique } },
  });
  if (count !== unique.length) {
    throw badRequest('Só é possível atribuir membros do workspace', 'INVALID_ASSIGNEE');
  }
  return unique;
}

/** Garante que todas as etiquetas pertencem ao quadro. */
async function assertLabels(boardId: string, labelIds: string[]) {
  const unique = [...new Set(labelIds)];
  if (unique.length === 0) return unique;
  const count = await prisma.label.count({ where: { boardId, id: { in: unique } } });
  if (count !== unique.length) {
    throw badRequest('Etiqueta inválida para este quadro', 'INVALID_LABEL');
  }
  return unique;
}

// ---------------------------------------------------------------------------
// Listagem com filtros, busca e paginação
// ---------------------------------------------------------------------------

export function buildCardWhere(boardId: string, filters: CardFilters, now = new Date()) {
  const where: Prisma.CardWhereInput = { boardId, archived: filters.archived ?? false };
  const and: Prisma.CardWhereInput[] = [];

  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.labelIds?.length) {
    and.push({ labels: { some: { labelId: { in: filters.labelIds } } } });
  }
  if (filters.assigneeIds?.length) {
    and.push({ assignees: { some: { userId: { in: filters.assigneeIds } } } });
  }
  if (filters.status === 'done') and.push({ completedAt: { not: null } });
  if (filters.status === 'open') and.push({ completedAt: null });

  switch (filters.due) {
    case 'overdue':
      and.push({ dueDate: { lt: now }, completedAt: null });
      break;
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      and.push({ dueDate: { gte: start, lt: new Date(start.getTime() + DAY) } });
      break;
    }
    case 'week':
      and.push({ dueDate: { gte: now, lte: new Date(now.getTime() + 7 * DAY) } });
      break;
    case 'none':
      and.push({ dueDate: null });
      break;
  }

  if (and.length) where.AND = and;
  return where;
}

export async function list(ctx: Ctx, boardId: string, filters: CardFilters) {
  await requireBoard(ctx.userId, boardId);
  const where = buildCardWhere(boardId, filters);
  const orderBy: Prisma.CardOrderByWithRelationInput[] =
    filters.sort === 'position'
      ? [{ column: { position: 'asc' } }, { position: 'asc' }]
      : [{ [filters.sort]: filters.sort === 'dueDate' ? { sort: 'asc', nulls: 'last' } : 'desc' }];

  const [cards, total] = await Promise.all([
    prisma.card.findMany({ where, orderBy, include: cardSummaryInclude, ...pageArgs(filters) }),
    prisma.card.count({ where }),
  ]);
  return paginate(cards.map(toCardSummary), total, filters);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function create(ctx: Ctx, columnId: string, input: CreateCardInput) {
  const { board, column } = await requireColumn(ctx.userId, columnId, 'card:write');
  const assigneeIds = await assertMembers(board.workspaceId, input.assigneeIds ?? []);
  const labelIds = await assertLabels(board.id, input.labelIds ?? []);

  const last = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const card = await prisma.card.create({
    data: {
      boardId: board.id,
      columnId,
      title: input.title,
      description: input.description ?? '',
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      completedAt: column.isDone ? new Date() : null,
      position: (last?.position ?? 0) + 1024,
      createdById: ctx.userId,
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      labels: { create: labelIds.map((labelId) => ({ labelId })) },
    },
    include: cardSummaryInclude,
  });

  await logActivity({
    workspaceId: board.workspaceId,
    boardId: board.id,
    cardId: card.id,
    actorId: ctx.userId,
    type: 'card.created',
    data: { cardTitle: card.title, columnTitle: column.title },
  });

  if (assigneeIds.length) {
    const name = await actorName(ctx.userId);
    await notify(
      assigneeIds.map((userId) => ({
        userId,
        actorId: ctx.userId,
        type: 'ASSIGNED' as const,
        message: `${name} atribuiu você ao cartão "${card.title}"`,
        data: { workspaceId: board.workspaceId, boardId: board.id, cardId: card.id },
      })),
    );
  }

  const summary = toCardSummary(card);
  realtimeBus.publishToBoard(ctx, board.id, { type: 'card.created', card: summary });
  return summary;
}

export async function getDetail(ctx: Ctx, cardId: string): Promise<CardDetail> {
  const { board } = await requireCard(ctx.userId, cardId);
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: {
      ...cardSummaryInclude,
      column: { select: { title: true } },
      createdBy: { select: userPublicSelect },
      assignees: {
        orderBy: { assignedAt: 'asc' },
        select: { userId: true, user: { select: userPublicSelect } },
      },
      labels: { select: { labelId: true, label: true } },
      checklists: {
        orderBy: { position: 'asc' },
        include: { items: { orderBy: { position: 'asc' } } },
      },
      attachments: { orderBy: { createdAt: 'desc' }, include: attachmentInclude },
    },
  });

  return {
    ...toCardSummary(card),
    description: card.description,
    workspaceId: board.workspaceId,
    columnTitle: card.column.title,
    createdBy: card.createdBy ? toUserPublic(card.createdBy) : null,
    assignees: card.assignees.map((assignee) => toUserPublic(assignee.user)),
    labels: card.labels.map((cardLabel) => toLabel(cardLabel.label)),
    checklists: card.checklists.map((checklist) => ({
      id: checklist.id,
      cardId: checklist.cardId,
      title: checklist.title,
      position: checklist.position,
      items: checklist.items.map((item) => ({
        id: item.id,
        checklistId: item.checklistId,
        text: item.text,
        done: item.done,
        position: item.position,
      })),
    })),
    attachments: card.attachments.map(toAttachment),
  };
}

export async function update(ctx: Ctx, cardId: string, input: UpdateCardInput) {
  const { board, card } = await requireCard(ctx.userId, cardId, 'card:write');
  const updated = await prisma.card.update({
    where: { id: cardId },
    data: {
      title: input.title,
      description: input.description,
      archived: input.archived,
      dueDate:
        input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
    },
    include: cardSummaryInclude,
  });

  const base = {
    workspaceId: board.workspaceId,
    boardId: board.id,
    cardId,
    actorId: ctx.userId,
  };
  if (input.archived !== undefined && input.archived !== card.archived) {
    await logActivity({ ...base, type: 'card.archived', data: { cardTitle: updated.title } });
  }
  if (input.dueDate !== undefined) {
    await logActivity({
      ...base,
      type: 'card.due_changed',
      data: { cardTitle: updated.title, dueDate: input.dueDate },
    });
  }
  const fields = (['title', 'description'] as const).filter((field) => input[field] !== undefined);
  if (fields.length) {
    await logActivity({
      ...base,
      type: 'card.updated',
      data: { cardTitle: updated.title, fields },
    });
  }

  const summary = toCardSummary(updated);
  if (input.archived === true) {
    realtimeBus.publishToBoard(ctx, board.id, {
      type: 'card.deleted',
      cardId,
      columnId: updated.columnId,
    });
  } else {
    realtimeBus.publishToBoard(ctx, board.id, { type: 'card.updated', card: summary });
  }
  return summary;
}

export async function move(ctx: Ctx, cardId: string, input: MoveCardInput) {
  const { board, card } = await requireCard(ctx.userId, cardId, 'card:write');
  const [target, source] = await Promise.all([
    prisma.boardColumn.findUnique({ where: { id: input.columnId } }),
    prisma.boardColumn.findUniqueOrThrow({ where: { id: card.columnId } }),
  ]);
  if (!target || target.boardId !== board.id) throw notFound('Coluna de destino não encontrada');

  const siblings = await prisma.card.findMany({
    where: { columnId: target.id, archived: false, NOT: { id: cardId } },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });
  const plan = planMove(siblings, input.index);
  const changedColumn = source.id !== target.id;
  const current = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    select: { completedAt: true },
  });
  const completedAt = target.isDone ? (current.completedAt ?? new Date()) : null;

  await prisma.$transaction(async (tx) => {
    if (plan.rebalanced) {
      for (const item of plan.rebalanced) {
        await tx.card.update({ where: { id: item.id }, data: { position: item.position } });
      }
    }
    await tx.card.update({
      where: { id: cardId },
      data: { columnId: target.id, position: plan.position, completedAt },
    });
    if (changedColumn) {
      await logActivity(
        {
          workspaceId: board.workspaceId,
          boardId: board.id,
          cardId,
          actorId: ctx.userId,
          type: target.isDone && !source.isDone ? 'card.completed' : 'card.moved',
          data: { cardTitle: card.title, fromColumn: source.title, toColumn: target.title },
        },
        tx,
      );
    }
  });

  const summary = await loadCardSummary(cardId);
  if (plan.rebalanced) {
    realtimeBus.publishToBoard(ctx, board.id, {
      type: 'cards.reordered',
      columnId: target.id,
      positions: plan.rebalanced,
    });
  }
  realtimeBus.publishToBoard(ctx, board.id, {
    type: 'card.moved',
    card: summary,
    fromColumnId: source.id,
  });
  return summary;
}

/** Exclui o cartão e devolve os arquivos de anexo para remoção do disco. */
export async function remove(ctx: Ctx, cardId: string): Promise<string[]> {
  const { board, card } = await requireCard(ctx.userId, cardId, 'card:write');
  const attachments = await prisma.attachment.findMany({
    where: { cardId },
    select: { storedName: true },
  });
  await prisma.card.delete({ where: { id: cardId } });
  await logActivity({
    workspaceId: board.workspaceId,
    boardId: board.id,
    actorId: ctx.userId,
    type: 'card.deleted',
    data: { cardTitle: card.title },
  });
  realtimeBus.publishToBoard(ctx, board.id, {
    type: 'card.deleted',
    cardId,
    columnId: card.columnId,
  });
  return attachments.map((attachment) => attachment.storedName);
}

// ---------------------------------------------------------------------------
// Responsáveis e etiquetas
// ---------------------------------------------------------------------------

export async function setAssignees(ctx: Ctx, cardId: string, input: SetAssigneesInput) {
  const { board, card } = await requireCard(ctx.userId, cardId, 'card:write');
  const userIds = await assertMembers(board.workspaceId, input.userIds);
  const current = await prisma.cardAssignee.findMany({
    where: { cardId },
    select: { userId: true, user: { select: { name: true } } },
  });
  const currentIds = new Set(current.map((assignee) => assignee.userId));
  const added = userIds.filter((id) => !currentIds.has(id));
  const removed = current.filter((assignee) => !userIds.includes(assignee.userId));

  await prisma.$transaction([
    prisma.cardAssignee.deleteMany({
      where: { cardId, userId: { in: removed.map((assignee) => assignee.userId) } },
    }),
    prisma.cardAssignee.createMany({ data: added.map((userId) => ({ cardId, userId })) }),
  ]);

  const base = { workspaceId: board.workspaceId, boardId: board.id, cardId, actorId: ctx.userId };
  if (added.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: added } },
      select: { id: true, name: true },
    });
    for (const user of users) {
      await logActivity({
        ...base,
        type: 'card.assigned',
        data: { cardTitle: card.title, userName: user.name },
      });
    }
    const name = await actorName(ctx.userId);
    await notify(
      added.map((userId) => ({
        userId,
        actorId: ctx.userId,
        type: 'ASSIGNED' as const,
        message: `${name} atribuiu você ao cartão "${card.title}"`,
        data: { workspaceId: board.workspaceId, boardId: board.id, cardId },
      })),
    );
  }
  for (const assignee of removed) {
    await logActivity({
      ...base,
      type: 'card.unassigned',
      data: { cardTitle: card.title, userName: assignee.user.name },
    });
  }

  const summary = await loadCardSummary(cardId);
  realtimeBus.publishToBoard(ctx, board.id, { type: 'card.updated', card: summary });
  return summary;
}

export async function setLabels(ctx: Ctx, cardId: string, input: SetLabelsInput) {
  const { board, card } = await requireCard(ctx.userId, cardId, 'card:write');
  const labelIds = await assertLabels(board.id, input.labelIds);
  await prisma.$transaction([
    prisma.cardLabel.deleteMany({ where: { cardId } }),
    prisma.cardLabel.createMany({ data: labelIds.map((labelId) => ({ cardId, labelId })) }),
  ]);
  const labels = await prisma.label.findMany({
    where: { id: { in: labelIds } },
    select: { name: true },
  });
  await logActivity({
    workspaceId: board.workspaceId,
    boardId: board.id,
    cardId,
    actorId: ctx.userId,
    type: 'card.labeled',
    data: { cardTitle: card.title, labelNames: labels.map((label) => label.name) },
  });

  const summary = await loadCardSummary(cardId);
  realtimeBus.publishToBoard(ctx, board.id, { type: 'card.updated', card: summary });
  return summary;
}
