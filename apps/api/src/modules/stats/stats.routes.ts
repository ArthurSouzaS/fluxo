import { Router } from 'express';
import { computeBoardStats } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { prisma } from '../../lib/prisma';
import { requireBoard } from '../access';

export const statsRouter = Router();

statsRouter.get('/boards/:boardId/stats', async (req, res) => {
  const { board } = await requireBoard(ctx(req).userId, req.params.boardId);
  const [columns, cards, members, labels] = await Promise.all([
    prisma.boardColumn.findMany({
      where: { boardId: board.id },
      select: { id: true, title: true, position: true, isDone: true },
    }),
    prisma.card.findMany({
      where: { boardId: board.id, archived: false },
      select: {
        id: true,
        title: true,
        columnId: true,
        dueDate: true,
        completedAt: true,
        assignees: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId: board.workspaceId },
      select: { user: { select: { id: true, name: true, avatarColor: true } } },
    }),
    prisma.label.findMany({
      where: { boardId: board.id },
      select: { id: true, name: true, color: true },
    }),
  ]);

  res.json(
    computeBoardStats({
      columns,
      labels,
      members: members.map((member) => member.user),
      cards: cards.map((card) => ({
        ...card,
        assigneeIds: card.assignees.map((assignee) => assignee.userId),
        labelIds: card.labels.map((label) => label.labelId),
      })),
    }),
  );
});
