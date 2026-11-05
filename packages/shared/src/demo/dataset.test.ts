import { describe, expect, it } from 'vitest';
import { createDemoDb } from './dataset';

describe('createDemoDb', () => {
  const db = createDemoDb(new Date('2026-06-10T12:00:00Z').getTime());

  it('gera dados consistentes (todas as referências existem)', () => {
    const users = new Set(db.users.map((u) => u.id));
    const boards = new Set(db.boards.map((b) => b.id));
    const columns = new Set(db.columns.map((c) => c.id));
    const labels = new Set(db.labels.map((l) => l.id));
    for (const card of db.cards) {
      expect(boards.has(card.boardId)).toBe(true);
      expect(columns.has(card.columnId)).toBe(true);
      card.assigneeIds.forEach((id) => expect(users.has(id)).toBe(true));
      card.labelIds.forEach((id) => expect(labels.has(id)).toBe(true));
    }
    expect(new Set(db.cards.map((c) => c.id)).size).toBe(db.cards.length);
  });

  it('só marca como concluídos os cartões das colunas de concluídos', () => {
    const doneColumns = new Set(db.columns.filter((c) => c.isDone).map((c) => c.id));
    for (const card of db.cards)
      expect(Boolean(card.completedAt)).toBe(doneColumns.has(card.columnId));
  });

  it('cria notificações para menções e atribuições', () => {
    const types = db.notifications.map((n) => n.type);
    expect(types).toContain('MENTION');
    expect(types).toContain('ASSIGNED');
  });
});
