import { describe, expect, it, vi } from 'vitest';
import { cardFiltersSchema } from '@fluxo/shared';

vi.mock('../../lib/prisma', () => ({ prisma: {} }));
const { buildCardWhere } = await import('./cards.service');

const now = new Date('2026-06-10T12:00:00Z');
const filters = (query: Record<string, string>) => cardFiltersSchema.parse(query);

describe('buildCardWhere', () => {
  it('sem filtros traz os cartões não arquivados do quadro', () => {
    expect(buildCardWhere('b1', filters({}), now)).toEqual({ boardId: 'b1', archived: false });
  });

  it('busca no título e na descrição sem diferenciar maiúsculas', () => {
    const where = buildCardWhere('b1', filters({ q: 'Login' }), now);
    expect(where.AND).toEqual([
      {
        OR: [
          { title: { contains: 'Login', mode: 'insensitive' } },
          { description: { contains: 'Login', mode: 'insensitive' } },
        ],
      },
    ]);
  });

  it('converte listas separadas por vírgula', () => {
    const where = buildCardWhere('b1', filters({ labelIds: 'l1, l2', assigneeIds: 'u1' }), now);
    expect(where.AND).toEqual([
      { labels: { some: { labelId: { in: ['l1', 'l2'] } } } },
      { assignees: { some: { userId: { in: ['u1'] } } } },
    ]);
  });

  it('atrasados = prazo vencido e não concluído', () => {
    expect(buildCardWhere('b1', filters({ due: 'overdue' }), now).AND).toEqual([
      { dueDate: { lt: now }, completedAt: null },
    ]);
  });

  it('próximos 7 dias e sem prazo', () => {
    expect(buildCardWhere('b1', filters({ due: 'week' }), now).AND).toEqual([
      { dueDate: { gte: now, lte: new Date('2026-06-17T12:00:00Z') } },
    ]);
    expect(buildCardWhere('b1', filters({ due: 'none' }), now).AND).toEqual([{ dueDate: null }]);
  });

  it('status e arquivados', () => {
    expect(buildCardWhere('b1', filters({ status: 'done', archived: 'true' }), now)).toEqual({
      boardId: 'b1',
      archived: true,
      AND: [{ completedAt: { not: null } }],
    });
  });
});
