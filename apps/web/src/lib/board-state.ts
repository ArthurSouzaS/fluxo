/**
 * Funções puras que atualizam o estado do quadro no cache do TanStack Query.
 * Usadas tanto na atualização otimista quanto nos eventos em tempo real.
 */
import {
  positionForIndex,
  rebalancePositions,
  type BoardDetail,
  type BoardEvent,
  type CardSummary,
  type Column,
} from '@fluxo/shared';

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

export function sortedColumns(board: BoardDetail): Column[] {
  return [...board.columns].sort(byPosition);
}

/** Cartões agrupados por coluna, já ordenados. */
export function cardsByColumn(cards: CardSummary[]): Map<string, CardSummary[]> {
  const map = new Map<string, CardSummary[]>();
  for (const card of [...cards].sort(byPosition)) {
    const list = map.get(card.columnId) ?? [];
    list.push(card);
    map.set(card.columnId, list);
  }
  return map;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const copy = list.slice();
  copy[index] = item;
  return copy;
}

function applyPositions<T extends { id: string; position: number }>(
  list: T[],
  positions: Array<{ id: string; position: number }>,
): T[] {
  const map = new Map(positions.map((entry) => [entry.id, entry.position]));
  return list.map((item) => (map.has(item.id) ? { ...item, position: map.get(item.id)! } : item));
}

export type BoardEventResult = BoardDetail | { action: 'refetch' } | { action: 'deleted' };

export function applyBoardEvent(board: BoardDetail, event: BoardEvent): BoardEventResult {
  switch (event.type) {
    case 'board.updated':
      return { ...board, ...event.board };
    case 'board.deleted':
      return { action: 'deleted' };
    case 'members.changed':
      return { action: 'refetch' };
    case 'column.created':
    case 'column.updated':
      return { ...board, columns: upsert(board.columns, event.column) };
    case 'column.deleted':
      return {
        ...board,
        columns: board.columns.filter((column) => column.id !== event.columnId),
        cards: board.cards.filter((card) => card.columnId !== event.columnId),
      };
    case 'columns.reordered':
      return { ...board, columns: applyPositions(board.columns, event.positions) };
    case 'card.created':
    case 'card.updated':
    case 'card.moved':
      if (event.card.archived) {
        return { ...board, cards: board.cards.filter((card) => card.id !== event.card.id) };
      }
      return { ...board, cards: upsert(board.cards, event.card) };
    case 'cards.reordered':
      return { ...board, cards: applyPositions(board.cards, event.positions) };
    case 'card.deleted':
      return { ...board, cards: board.cards.filter((card) => card.id !== event.cardId) };
    case 'label.created':
    case 'label.updated':
      return { ...board, labels: upsert(board.labels, event.label) };
    case 'label.deleted':
      return {
        ...board,
        labels: board.labels.filter((label) => label.id !== event.labelId),
        cards: board.cards.map((card) =>
          card.labelIds.includes(event.labelId)
            ? { ...card, labelIds: card.labelIds.filter((id) => id !== event.labelId) }
            : card,
        ),
      };
    case 'comment.created':
    case 'comment.updated':
    case 'comment.deleted':
      return board;
  }
}

/**
 * Move um cartão localmente (atualização otimista), calculando a posição
 * como a API faz. Se faltar espaço, renumera a coluna de destino.
 */
export function moveCardLocally(
  board: BoardDetail,
  cardId: string,
  toColumnId: string,
  index: number,
): BoardDetail {
  const card = board.cards.find((entry) => entry.id === cardId);
  const target = board.columns.find((column) => column.id === toColumnId);
  if (!card || !target) return board;

  const siblings = board.cards
    .filter((entry) => entry.columnId === toColumnId && entry.id !== cardId)
    .sort(byPosition);
  let position = positionForIndex(
    siblings.map((entry) => entry.position),
    index,
  );
  let others = board.cards;
  if (position === null) {
    const positions = rebalancePositions(siblings.length + 1);
    const clamped = Math.max(0, Math.min(index, siblings.length));
    position = positions[clamped]!;
    const updates = new Map<string, number>();
    siblings.forEach((sibling, i) => updates.set(sibling.id, positions[i >= clamped ? i + 1 : i]!));
    others = board.cards.map((entry) =>
      updates.has(entry.id) ? { ...entry, position: updates.get(entry.id)! } : entry,
    );
  }

  const completedAt = target.isDone ? (card.completedAt ?? new Date().toISOString()) : null;
  return {
    ...board,
    cards: others.map((entry) =>
      entry.id === cardId
        ? { ...entry, columnId: toColumnId, position: position!, completedAt }
        : entry,
    ),
  };
}

/** Reordena uma coluna localmente. */
export function moveColumnLocally(
  board: BoardDetail,
  columnId: string,
  index: number,
): BoardDetail {
  const siblings = sortedColumns(board).filter((column) => column.id !== columnId);
  const position =
    positionForIndex(
      siblings.map((column) => column.position),
      index,
    ) ?? index * 1024 + 512;
  return {
    ...board,
    columns: board.columns.map((column) =>
      column.id === columnId ? { ...column, position } : column,
    ),
  };
}

// ---------------------------------------------------------------------------
// Filtros do quadro (aplicados no navegador)
// ---------------------------------------------------------------------------

export interface BoardFilters {
  q: string;
  labelIds: string[];
  assigneeIds: string[];
  due: '' | 'overdue' | 'week' | 'none';
}

export const emptyFilters: BoardFilters = { q: '', labelIds: [], assigneeIds: [], due: '' };

export function hasActiveFilters(filters: BoardFilters) {
  return Boolean(
    filters.q.trim() || filters.labelIds.length || filters.assigneeIds.length || filters.due,
  );
}

export function filterCards(
  cards: CardSummary[],
  filters: BoardFilters,
  now = Date.now(),
): CardSummary[] {
  const q = filters.q.trim().toLowerCase();
  return cards.filter((card) => {
    if (q && !card.title.toLowerCase().includes(q)) return false;
    if (filters.labelIds.length && !filters.labelIds.some((id) => card.labelIds.includes(id)))
      return false;
    if (
      filters.assigneeIds.length &&
      !filters.assigneeIds.some((id) => card.assigneeIds.includes(id))
    )
      return false;
    const due = card.dueDate ? new Date(card.dueDate).getTime() : null;
    switch (filters.due) {
      case 'overdue':
        return due !== null && due < now && !card.completedAt;
      case 'week':
        return due !== null && due >= now && due <= now + 7 * 24 * 60 * 60 * 1000;
      case 'none':
        return due === null;
      default:
        return true;
    }
  });
}
