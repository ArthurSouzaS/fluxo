import type {
  Checklist,
  CreateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistInput,
  UpdateChecklistItemInput,
} from '@fluxo/shared';
import type { Ctx } from '../../lib/context';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { logActivity } from '../activities/activity.logger';
import { requireCard, requireChecklist, requireChecklistItem } from '../access';
import { loadCardSummary } from '../cards/card-summary';

async function loadChecklist(checklistId: string): Promise<Checklist> {
  const checklist = await prisma.checklist.findUniqueOrThrow({
    where: { id: checklistId },
    include: { items: { orderBy: { position: 'asc' } } },
  });
  return {
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
  };
}

/** O progresso do checklist aparece no cartão: avisa o quadro. */
async function publishCard(ctx: Ctx, boardId: string, cardId: string) {
  const card = await loadCardSummary(cardId);
  realtimeBus.publishToBoard(ctx, boardId, { type: 'card.updated', card });
}

export async function create(ctx: Ctx, cardId: string, input: CreateChecklistInput) {
  const { board, card } = await requireCard(ctx.userId, cardId, 'card:write');
  const last = await prisma.checklist.findFirst({
    where: { cardId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const checklist = await prisma.checklist.create({
    data: { cardId, title: input.title, position: (last?.position ?? 0) + 1024 },
  });
  await logActivity({
    workspaceId: board.workspaceId,
    boardId: board.id,
    cardId,
    actorId: ctx.userId,
    type: 'checklist.created',
    data: { cardTitle: card.title, checklistTitle: checklist.title },
  });
  await publishCard(ctx, board.id, cardId);
  return loadChecklist(checklist.id);
}

export async function update(ctx: Ctx, checklistId: string, input: UpdateChecklistInput) {
  await requireChecklist(ctx.userId, checklistId, 'card:write');
  await prisma.checklist.update({ where: { id: checklistId }, data: { title: input.title } });
  return loadChecklist(checklistId);
}

export async function remove(ctx: Ctx, checklistId: string) {
  const { board, checklist } = await requireChecklist(ctx.userId, checklistId, 'card:write');
  await prisma.checklist.delete({ where: { id: checklistId } });
  await publishCard(ctx, board.id, checklist.card.id);
}

export async function addItem(ctx: Ctx, checklistId: string, input: CreateChecklistItemInput) {
  const { board, checklist } = await requireChecklist(ctx.userId, checklistId, 'card:write');
  const last = await prisma.checklistItem.findFirst({
    where: { checklistId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  await prisma.checklistItem.create({
    data: { checklistId, text: input.text, position: (last?.position ?? 0) + 1024 },
  });
  await publishCard(ctx, board.id, checklist.card.id);
  return loadChecklist(checklistId);
}

export async function updateItem(ctx: Ctx, itemId: string, input: UpdateChecklistItemInput) {
  const { board, item } = await requireChecklistItem(ctx.userId, itemId, 'card:write');
  const updated = await prisma.checklistItem.update({ where: { id: itemId }, data: input });
  const card = item.checklist.card;
  if (input.done === true && !item.done) {
    await logActivity({
      workspaceId: board.workspaceId,
      boardId: board.id,
      cardId: card.id,
      actorId: ctx.userId,
      type: 'checklist.item_completed',
      data: { cardTitle: card.title, itemText: updated.text },
    });
  }
  await publishCard(ctx, board.id, card.id);
  return loadChecklist(item.checklistId);
}

export async function removeItem(ctx: Ctx, itemId: string) {
  const { board, item } = await requireChecklistItem(ctx.userId, itemId, 'card:write');
  await prisma.checklistItem.delete({ where: { id: itemId } });
  await publishCard(ctx, board.id, item.checklist.card.id);
  return loadChecklist(item.checklistId);
}
