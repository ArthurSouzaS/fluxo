import { can, extractMentions, type CommentBodyInput, type PaginationQuery } from '@fluxo/shared';
import type { Ctx } from '../../lib/context';
import { forbidden } from '../../lib/errors';
import { commentInclude, toComment } from '../../lib/mappers';
import { pageArgs, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { logActivity } from '../activities/activity.logger';
import { requireCard, requireComment } from '../access';
import { loadCardSummary } from '../cards/card-summary';
import { notify, type NewNotification } from '../notifications/notify';

export async function list(ctx: Ctx, cardId: string, query: PaginationQuery) {
  await requireCard(ctx.userId, cardId);
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'desc' },
      include: commentInclude,
      ...pageArgs(query),
    }),
    prisma.comment.count({ where: { cardId } }),
  ]);
  return paginate(comments.map(toComment), total, query);
}

/**
 * Notifica quem foi mencionado (@apelido) e os responsáveis pelo cartão.
 * Só membros do workspace podem ser notificados.
 */
async function notifyComment(
  ctx: Ctx,
  params: {
    workspaceId: string;
    boardId: string;
    cardId: string;
    cardTitle: string;
    commentId: string;
    body: string;
  },
) {
  const author = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { name: true },
  });
  const data = {
    workspaceId: params.workspaceId,
    boardId: params.boardId,
    cardId: params.cardId,
    commentId: params.commentId,
  };

  const usernames = extractMentions(params.body);
  const mentioned = usernames.length
    ? await prisma.user.findMany({
        where: {
          username: { in: usernames },
          memberships: { some: { workspaceId: params.workspaceId } },
        },
        select: { id: true },
      })
    : [];
  const mentionedIds = new Set(mentioned.map((user) => user.id));

  const assignees = await prisma.cardAssignee.findMany({
    where: { cardId: params.cardId },
    select: { userId: true },
  });

  const notifications: NewNotification[] = [
    ...[...mentionedIds].map((userId) => ({
      userId,
      actorId: ctx.userId,
      type: 'MENTION' as const,
      message: `${author.name} mencionou você em "${params.cardTitle}"`,
      data,
    })),
    ...assignees
      .filter((assignee) => !mentionedIds.has(assignee.userId))
      .map((assignee) => ({
        userId: assignee.userId,
        actorId: ctx.userId,
        type: 'COMMENT' as const,
        message: `${author.name} comentou em "${params.cardTitle}"`,
        data,
      })),
  ];
  await notify(notifications);
}

export async function create(ctx: Ctx, cardId: string, input: CommentBodyInput) {
  const { board, card } = await requireCard(ctx.userId, cardId, 'comment:create');
  const comment = await prisma.comment.create({
    data: { cardId, authorId: ctx.userId, body: input.body },
    include: commentInclude,
  });
  await logActivity({
    workspaceId: board.workspaceId,
    boardId: board.id,
    cardId,
    actorId: ctx.userId,
    type: 'comment.created',
    data: { cardTitle: card.title },
  });
  await notifyComment(ctx, {
    workspaceId: board.workspaceId,
    boardId: board.id,
    cardId,
    cardTitle: card.title,
    commentId: comment.id,
    body: comment.body,
  });

  const dto = toComment(comment);
  realtimeBus.publishToBoard(ctx, board.id, { type: 'comment.created', comment: dto });
  realtimeBus.publishToBoard(ctx, board.id, {
    type: 'card.updated',
    card: await loadCardSummary(cardId),
  });
  return dto;
}

export async function update(ctx: Ctx, commentId: string, input: CommentBodyInput) {
  const { board, role, comment } = await requireComment(ctx.userId, commentId);
  if (comment.authorId !== ctx.userId || !can(role, 'comment:create')) {
    throw forbidden('Só o autor pode editar o comentário');
  }
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body: input.body },
    include: commentInclude,
  });
  const dto = toComment(updated);
  realtimeBus.publishToBoard(ctx, board.id, { type: 'comment.updated', comment: dto });
  return dto;
}

export async function remove(ctx: Ctx, commentId: string) {
  const { board, role, comment } = await requireComment(ctx.userId, commentId);
  const isAuthor = comment.authorId === ctx.userId && can(role, 'comment:create');
  if (!isAuthor && !can(role, 'comment:moderate')) {
    throw forbidden('Você não pode excluir este comentário');
  }
  await prisma.comment.delete({ where: { id: commentId } });
  realtimeBus.publishToBoard(ctx, board.id, {
    type: 'comment.deleted',
    cardId: comment.cardId,
    commentId,
  });
  realtimeBus.publishToBoard(ctx, board.id, {
    type: 'card.updated',
    card: await loadCardSummary(comment.cardId),
  });
}
