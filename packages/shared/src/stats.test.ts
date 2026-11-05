import { describe, expect, it } from 'vitest';
import { computeBoardStats, startOfWeek, type StatsInput } from './stats';

const now = new Date('2026-11-05T12:00:00'); // quinta-feira
const day = (offset: number) => new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);

const input: StatsInput = {
  columns: [
    { id: 'done', title: 'Concluído', position: 3, isDone: true },
    { id: 'todo', title: 'A fazer', position: 1, isDone: false },
    { id: 'doing', title: 'Fazendo', position: 2, isDone: false },
  ],
  members: [
    { id: 'u1', name: 'Ana', avatarColor: '#111111' },
    { id: 'u2', name: 'Bruno', avatarColor: '#222222' },
  ],
  labels: [
    { id: 'l1', name: 'Bug', color: '#ff0000' },
    { id: 'l2', name: 'Front', color: '#00ff00' },
  ],
  cards: [
    {
      id: 'c1',
      title: 'Atrasado',
      columnId: 'todo',
      dueDate: day(-2),
      completedAt: null,
      assigneeIds: ['u1'],
      labelIds: ['l1'],
    },
    {
      id: 'c2',
      title: 'Semana',
      columnId: 'doing',
      dueDate: day(3),
      completedAt: null,
      assigneeIds: ['u1', 'u2'],
      labelIds: ['l1', 'l2'],
    },
    {
      id: 'c3',
      title: 'Sem prazo',
      columnId: 'todo',
      dueDate: null,
      completedAt: null,
      assigneeIds: [],
      labelIds: [],
    },
    {
      id: 'c4',
      title: 'Feito hoje',
      columnId: 'done',
      dueDate: day(-5),
      completedAt: day(0),
      assigneeIds: ['u2'],
      labelIds: [],
    },
    {
      id: 'c5',
      title: 'Feito há 2 semanas',
      columnId: 'done',
      dueDate: null,
      completedAt: day(-14).toISOString(),
      assigneeIds: ['u2'],
      labelIds: ['l2'],
    },
  ],
};

describe('computeBoardStats', () => {
  const stats = computeBoardStats(input, now);

  it('calcula os totais', () => {
    expect(stats.totals).toEqual({ total: 5, open: 3, done: 2, overdue: 1, dueThisWeek: 1 });
  });

  it('agrupa por coluna na ordem do quadro', () => {
    expect(stats.byColumn.map((c) => [c.title, c.count])).toEqual([
      ['A fazer', 2],
      ['Fazendo', 1],
      ['Concluído', 2],
    ]);
  });

  it('agrupa por responsável, com "Sem responsável" por último', () => {
    expect(stats.byAssignee).toEqual([
      { userId: 'u2', name: 'Bruno', avatarColor: '#222222', open: 1, done: 2 },
      { userId: 'u1', name: 'Ana', avatarColor: '#111111', open: 2, done: 0 },
      { userId: null, name: 'Sem responsável', avatarColor: '#64748b', open: 1, done: 0 },
    ]);
  });

  it('não considera atrasado um cartão concluído', () => {
    expect(stats.overdue.map((c) => c.id)).toEqual(['c1']);
    expect(stats.overdue[0]!.assignees).toEqual(['Ana']);
  });

  it('conta concluídos por semana nas últimas 8 semanas', () => {
    expect(stats.completedPerWeek).toHaveLength(8);
    expect(stats.completedPerWeek.at(-1)).toEqual({ weekStart: '2026-11-02', count: 1 });
    expect(stats.completedPerWeek.at(-3)!.count).toBe(1);
    expect(stats.completedPerWeek.reduce((sum, w) => sum + w.count, 0)).toBe(2);
  });

  it('ordena etiquetas pela quantidade', () => {
    expect(stats.byLabel.map((l) => [l.name, l.count])).toEqual([
      ['Bug', 2],
      ['Front', 2],
    ]);
  });
});

describe('startOfWeek', () => {
  it('volta para a segunda-feira', () => {
    expect(startOfWeek(new Date('2026-11-08T23:00:00')).getDate()).toBe(2);
    expect(startOfWeek(new Date('2026-11-02T08:00:00')).getDate()).toBe(2);
  });
});
