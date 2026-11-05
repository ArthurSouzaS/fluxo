/**
 * Cálculo das estatísticas do dashboard de um quadro.
 * Função pura: usada pela API e pelo modo demonstração da web.
 */
import type { BoardStats } from './types';

export interface StatsInput {
  columns: Array<{ id: string; title: string; position: number; isDone: boolean }>;
  cards: Array<{
    id: string;
    title: string;
    columnId: string;
    dueDate: Date | string | null;
    completedAt: Date | string | null;
    assigneeIds: string[];
    labelIds: string[];
  }>;
  members: Array<{ id: string; name: string; avatarColor: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
}

const DAY = 24 * 60 * 60 * 1000;
export const STATS_WEEKS = 8;

const toDate = (value: Date | string | null): Date | null =>
  value === null ? null : value instanceof Date ? value : new Date(value);

/** Segunda-feira (00:00, horário local) da semana da data informada. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const weekday = (result.getDay() + 6) % 7; // segunda = 0
  result.setDate(result.getDate() - weekday);
  return result;
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeBoardStats(input: StatsInput, now = new Date()): BoardStats {
  const columns = [...input.columns].sort((a, b) => a.position - b.position);
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const cards = input.cards.map((card) => ({
    ...card,
    due: toDate(card.dueDate),
    completed: toDate(card.completedAt),
  }));
  const isDone = (card: (typeof cards)[number]) =>
    card.completed !== null || columnById.get(card.columnId)?.isDone === true;

  const open = cards.filter((card) => !isDone(card));
  const overdue = open
    .filter((card) => card.due !== null && card.due < now)
    .sort((a, b) => a.due!.getTime() - b.due!.getTime());
  const weekAhead = new Date(now.getTime() + 7 * DAY);
  const dueThisWeek = open.filter(
    (card) => card.due !== null && card.due >= now && card.due <= weekAhead,
  );

  const memberById = new Map(input.members.map((member) => [member.id, member]));
  const assigneeStats = new Map<string | null, { open: number; done: number }>();
  for (const card of cards) {
    const keys = card.assigneeIds.length ? card.assigneeIds : [null];
    for (const key of keys) {
      const entry = assigneeStats.get(key) ?? { open: 0, done: 0 };
      if (isDone(card)) entry.done += 1;
      else entry.open += 1;
      assigneeStats.set(key, entry);
    }
  }

  const firstWeek = startOfWeek(new Date(now.getTime() - (STATS_WEEKS - 1) * 7 * DAY));
  const weeks = Array.from({ length: STATS_WEEKS }, (_, i) => {
    const start = new Date(firstWeek);
    start.setDate(firstWeek.getDate() + i * 7);
    return { start, count: 0 };
  });
  for (const card of cards) {
    if (!card.completed || card.completed < firstWeek) continue;
    // Math.round absorve a hora a mais/a menos do horário de verão.
    const index = Math.round(
      (startOfWeek(card.completed).getTime() - firstWeek.getTime()) / (7 * DAY),
    );
    const week = weeks[index];
    if (week) week.count += 1;
  }

  return {
    totals: {
      total: cards.length,
      open: open.length,
      done: cards.length - open.length,
      overdue: overdue.length,
      dueThisWeek: dueThisWeek.length,
    },
    byColumn: columns.map((column) => ({
      columnId: column.id,
      title: column.title,
      isDone: column.isDone,
      count: cards.filter((card) => card.columnId === column.id).length,
    })),
    byAssignee: [...assigneeStats.entries()]
      .map(([userId, counts]) => {
        const member = userId ? memberById.get(userId) : undefined;
        return {
          userId,
          name: userId ? (member?.name ?? 'Ex-membro') : 'Sem responsável',
          avatarColor: member?.avatarColor ?? '#64748b',
          ...counts,
        };
      })
      .sort((a, b) =>
        a.userId === null ? 1 : b.userId === null ? -1 : b.open + b.done - (a.open + a.done),
      ),
    byLabel: input.labels
      .map((label) => ({
        labelId: label.id,
        name: label.name,
        color: label.color,
        count: cards.filter((card) => card.labelIds.includes(label.id)).length,
      }))
      .sort((a, b) => b.count - a.count),
    overdue: overdue.slice(0, 10).map((card) => ({
      id: card.id,
      title: card.title,
      dueDate: card.due!.toISOString(),
      columnTitle: columnById.get(card.columnId)?.title ?? '',
      assignees: card.assigneeIds.map((id) => memberById.get(id)?.name ?? 'Ex-membro'),
    })),
    completedPerWeek: weeks.map((week) => ({ weekStart: isoDay(week.start), count: week.count })),
  };
}
