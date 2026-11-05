import type { BoardDetail, CardSummary } from '@fluxo/shared';
import {
  applyBoardEvent,
  cardsByColumn,
  filterCards,
  moveCardLocally,
  moveColumnLocally,
  sortedColumns,
} from './board-state';

function card(
  id: string,
  columnId: string,
  position: number,
  extra: Partial<CardSummary> = {},
): CardSummary {
  return {
    id,
    boardId: 'b1',
    columnId,
    title: `Cartão ${id}`,
    position,
    dueDate: null,
    completedAt: null,
    archived: false,
    hasDescription: false,
    labelIds: [],
    assigneeIds: [],
    commentCount: 0,
    attachmentCount: 0,
    checklist: { done: 0, total: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

const board: BoardDetail = {
  id: 'b1',
  workspaceId: 'w1',
  workspaceName: 'W',
  title: 'Quadro',
  description: null,
  color: '#34d399',
  archived: false,
  myRole: 'OWNER',
  columns: [
    { id: 'todo', boardId: 'b1', title: 'A fazer', position: 1024, wipLimit: null, isDone: false },
    { id: 'done', boardId: 'b1', title: 'Feito', position: 2048, wipLimit: null, isDone: true },
  ],
  cards: [
    card('a', 'todo', 1024),
    card('b', 'todo', 2048),
    card('c', 'done', 1024, { completedAt: '2026-01-02T00:00:00.000Z' }),
  ],
  labels: [{ id: 'l1', boardId: 'b1', name: 'Bug', color: '#f00' }],
  members: [],
  createdAt: '',
  updatedAt: '',
};

const ids = (b: BoardDetail, columnId: string) =>
  (cardsByColumn(b.cards).get(columnId) ?? []).map((c) => c.id);

describe('moveCardLocally', () => {
  it('reordena dentro da coluna', () => {
    const next = moveCardLocally(board, 'b', 'todo', 0);
    expect(ids(next, 'todo')).toEqual(['b', 'a']);
  });

  it('move para coluna concluída e marca como concluído', () => {
    const next = moveCardLocally(board, 'a', 'done', 0);
    expect(ids(next, 'done')).toEqual(['a', 'c']);
    expect(next.cards.find((c) => c.id === 'a')!.completedAt).not.toBeNull();
  });

  it('reabre ao sair da coluna concluída', () => {
    const next = moveCardLocally(board, 'c', 'todo', 1);
    expect(ids(next, 'todo')).toEqual(['a', 'c', 'b']);
    expect(next.cards.find((c) => c.id === 'c')!.completedAt).toBeNull();
  });

  it('renumera quando não há espaço', () => {
    const tight = {
      ...board,
      cards: [card('a', 'todo', 1), card('b', 'todo', 1.0001), card('x', 'done', 1)],
    };
    const next = moveCardLocally(tight, 'x', 'todo', 1);
    expect(ids(next, 'todo')).toEqual(['a', 'x', 'b']);
  });

  it('ignora cartão inexistente', () => {
    expect(moveCardLocally(board, 'zzz', 'todo', 0)).toBe(board);
  });
});

describe('moveColumnLocally', () => {
  it('move a coluna para o início', () => {
    expect(sortedColumns(moveColumnLocally(board, 'done', 0)).map((c) => c.id)).toEqual([
      'done',
      'todo',
    ]);
  });
});

describe('applyBoardEvent', () => {
  it('insere e atualiza cartões', () => {
    const created = applyBoardEvent(board, {
      type: 'card.created',
      card: card('d', 'todo', 4096),
    }) as BoardDetail;
    expect(ids(created, 'todo')).toEqual(['a', 'b', 'd']);
    const updated = applyBoardEvent(created, {
      type: 'card.updated',
      card: card('d', 'todo', 4096, { title: 'Novo' }),
    }) as BoardDetail;
    expect(updated.cards.find((c) => c.id === 'd')!.title).toBe('Novo');
  });

  it('remove cartão arquivado', () => {
    const next = applyBoardEvent(board, {
      type: 'card.updated',
      card: card('a', 'todo', 1024, { archived: true }),
    }) as BoardDetail;
    expect(ids(next, 'todo')).toEqual(['b']);
  });

  it('remove coluna e seus cartões', () => {
    const next = applyBoardEvent(board, {
      type: 'column.deleted',
      columnId: 'todo',
    }) as BoardDetail;
    expect(next.columns).toHaveLength(1);
    expect(next.cards.map((c) => c.id)).toEqual(['c']);
  });

  it('tira a etiqueta excluída dos cartões', () => {
    const labeled = { ...board, cards: [card('a', 'todo', 1, { labelIds: ['l1'] })] };
    const next = applyBoardEvent(labeled, { type: 'label.deleted', labelId: 'l1' }) as BoardDetail;
    expect(next.labels).toHaveLength(0);
    expect(next.cards[0]!.labelIds).toEqual([]);
  });

  it('pede recarga quando membros mudam e avisa exclusão do quadro', () => {
    expect(applyBoardEvent(board, { type: 'members.changed' })).toEqual({ action: 'refetch' });
    expect(applyBoardEvent(board, { type: 'board.deleted', boardId: 'b1' })).toEqual({
      action: 'deleted',
    });
  });

  it('aplica renumeração', () => {
    const next = applyBoardEvent(board, {
      type: 'cards.reordered',
      columnId: 'todo',
      positions: [
        { id: 'a', position: 3000 },
        { id: 'b', position: 1000 },
      ],
    }) as BoardDetail;
    expect(ids(next, 'todo')).toEqual(['b', 'a']);
  });
});

describe('filterCards', () => {
  const now = new Date('2026-06-10T12:00:00Z').getTime();
  const cards = [
    card('1', 'todo', 1, { title: 'Login', labelIds: ['l1'], dueDate: '2026-06-01T00:00:00Z' }),
    card('2', 'todo', 2, {
      title: 'Cadastro',
      assigneeIds: ['u1'],
      dueDate: '2026-06-12T00:00:00Z',
    }),
    card('3', 'todo', 3, { title: 'Deploy' }),
  ];
  const base = { q: '', labelIds: [], assigneeIds: [], due: '' as const };

  it('filtra por texto, etiqueta, responsável e prazo', () => {
    expect(filterCards(cards, { ...base, q: 'log' }, now).map((c) => c.id)).toEqual(['1']);
    expect(filterCards(cards, { ...base, labelIds: ['l1'] }, now).map((c) => c.id)).toEqual(['1']);
    expect(filterCards(cards, { ...base, assigneeIds: ['u1'] }, now).map((c) => c.id)).toEqual([
      '2',
    ]);
    expect(filterCards(cards, { ...base, due: 'overdue' }, now).map((c) => c.id)).toEqual(['1']);
    expect(filterCards(cards, { ...base, due: 'week' }, now).map((c) => c.id)).toEqual(['2']);
    expect(filterCards(cards, { ...base, due: 'none' }, now).map((c) => c.id)).toEqual(['3']);
  });
});
