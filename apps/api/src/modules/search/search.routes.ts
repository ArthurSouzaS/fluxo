import { Router } from 'express';
import { searchQuerySchema, type SearchResults } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { prisma } from '../../lib/prisma';

export const searchRouter = Router();

/** Busca global em quadros e cartões de todos os workspaces do usuário. */
searchRouter.get('/search', async (req, res) => {
  const { userId } = ctx(req);
  const { q, limit } = searchQuerySchema.parse(req.query);
  const inMyWorkspaces = { workspace: { members: { some: { userId } } } };

  const [boards, cards] = await Promise.all([
    prisma.board.findMany({
      where: { ...inMyWorkspaces, archived: false, title: { contains: q, mode: 'insensitive' } },
      select: { id: true, title: true, color: true, workspace: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    prisma.card.findMany({
      where: {
        archived: false,
        board: { ...inMyWorkspaces, archived: false },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        boardId: true,
        completedAt: true,
        board: { select: { title: true } },
        column: { select: { title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
  ]);

  const body: SearchResults = {
    boards: boards.map((board) => ({
      id: board.id,
      title: board.title,
      color: board.color,
      workspaceName: board.workspace.name,
    })),
    cards: cards.map((card) => ({
      id: card.id,
      title: card.title,
      boardId: card.boardId,
      boardTitle: card.board.title,
      columnTitle: card.column.title,
      completedAt: card.completedAt?.toISOString() ?? null,
    })),
  };
  res.json(body);
});
