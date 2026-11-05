import {
  POSITION_STEP,
  type BoardDetail,
  type BoardSummary,
  type BoardTemplate,
  type CreateBoardInput,
  type Role,
  type UpdateBoardInput,
} from '@fluxo/shared';
import { createBoardSchema } from '@fluxo/shared';
import type { Ctx } from '../../lib/context';
import {
  cardSummaryInclude,
  memberInclude,
  toCardSummary,
  toColumn,
  toLabel,
  toMember,
} from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { logActivity } from '../activities/activity.logger';
import { requireBoard, requireWorkspace } from '../access';

const TEMPLATE_COLUMNS: Record<BoardTemplate, Array<{ title: string; isDone?: boolean }>> = {
  kanban: [{ title: 'A fazer' }, { title: 'Em andamento' }, { title: 'Concluído', isDone: true }],
  scrum: [
    { title: 'Backlog' },
    { title: 'A fazer' },
    { title: 'Em andamento' },
    { title: 'Em revisão' },
    { title: 'Concluído', isDone: true },
  ],
  blank: [],
};

const DEFAULT_LABELS = [
  { name: 'Bug', color: '#f87171' },
  { name: 'Melhoria', color: '#34d399' },
  { name: 'Urgente', color: '#fb923c' },
  { name: 'Documentação', color: '#38bdf8' },
];

const BOARD_COLORS = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#f472b6'];

export async function listByWorkspace(
  ctx: Ctx,
  workspaceId: string,
  archived = false,
): Promise<BoardSummary[]> {
  await requireWorkspace(ctx.userId, workspaceId);
  const boards = await prisma.board.findMany({
    where: { workspaceId, archived },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { cards: { where: { archived: false } } } } },
  });
  return boards.map((board) => ({
    id: board.id,
    workspaceId: board.workspaceId,
    title: board.title,
    description: board.description,
    color: board.color,
    archived: board.archived,
    cardCount: board._count.cards,
    updatedAt: board.updatedAt.toISOString(),
  }));
}

export async function create(ctx: Ctx, workspaceId: string, rawInput: CreateBoardInput) {
  await requireWorkspace(ctx.userId, workspaceId, 'board:create');
  const input = createBoardSchema.parse(rawInput);
  const template = input.template;

  const board = await prisma.$transaction(async (tx) => {
    const created = await tx.board.create({
      data: {
        workspaceId,
        title: input.title,
        description: input.description || null,
        color: input.color ?? BOARD_COLORS[Math.floor(Math.random() * BOARD_COLORS.length)]!,
        createdById: ctx.userId,
        columns: {
          create: TEMPLATE_COLUMNS[template].map((column, index) => ({
            title: column.title,
            isDone: column.isDone ?? false,
            position: (index + 1) * POSITION_STEP,
          })),
        },
        labels: { create: template === 'blank' ? [] : DEFAULT_LABELS },
      },
    });
    await logActivity(
      {
        workspaceId,
        boardId: created.id,
        actorId: ctx.userId,
        type: 'board.created',
        data: { boardTitle: created.title },
      },
      tx,
    );
    return created;
  });

  return getDetail(ctx, board.id);
}

export async function getDetail(ctx: Ctx, boardId: string): Promise<BoardDetail> {
  const { role } = await requireBoard(ctx.userId, boardId);
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: {
      workspace: {
        select: {
          name: true,
          members: { include: memberInclude, orderBy: { joinedAt: 'asc' } },
        },
      },
      columns: { orderBy: { position: 'asc' } },
      labels: { orderBy: { createdAt: 'asc' } },
      cards: {
        where: { archived: false },
        orderBy: { position: 'asc' },
        include: cardSummaryInclude,
      },
    },
  });

  return {
    id: board.id,
    workspaceId: board.workspaceId,
    workspaceName: board.workspace.name,
    title: board.title,
    description: board.description,
    color: board.color,
    archived: board.archived,
    myRole: role as Role,
    columns: board.columns.map(toColumn),
    cards: board.cards.map(toCardSummary),
    labels: board.labels.map(toLabel),
    members: board.workspace.members.map(toMember),
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export async function update(ctx: Ctx, boardId: string, input: UpdateBoardInput) {
  const { board } = await requireBoard(ctx.userId, boardId, 'board:update');
  const updated = await prisma.board.update({
    where: { id: boardId },
    data: {
      ...input,
      description: input.description === undefined ? undefined : input.description || null,
    },
  });
  await logActivity({
    workspaceId: board.workspaceId,
    boardId,
    actorId: ctx.userId,
    type: 'board.updated',
    data: { boardTitle: updated.title },
  });
  realtimeBus.publishToBoard(ctx, boardId, {
    type: 'board.updated',
    board: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      color: updated.color,
      archived: updated.archived,
    },
  });
  return getDetail(ctx, boardId);
}

/** Exclui o quadro e devolve os nomes dos arquivos de anexo para remoção do disco. */
export async function remove(ctx: Ctx, boardId: string): Promise<string[]> {
  await requireBoard(ctx.userId, boardId, 'board:delete');
  const attachments = await prisma.attachment.findMany({
    where: { card: { boardId } },
    select: { storedName: true },
  });
  await prisma.board.delete({ where: { id: boardId } });
  realtimeBus.publishToBoard(ctx, boardId, { type: 'board.deleted', boardId });
  return attachments.map((attachment) => attachment.storedName);
}
