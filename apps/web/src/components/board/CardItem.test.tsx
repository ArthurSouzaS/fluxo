import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { CardSummary, Label, Member } from '@fluxo/shared';
import { CardItem } from './CardItem';

const card: CardSummary = {
  id: 'c1',
  boardId: 'b1',
  columnId: 'todo',
  title: 'Corrigir login',
  position: 1024,
  dueDate: new Date(Date.now() - 86_400_000).toISOString(),
  completedAt: null,
  archived: false,
  hasDescription: true,
  labelIds: ['l1'],
  assigneeIds: ['u1'],
  commentCount: 3,
  attachmentCount: 1,
  checklist: { done: 1, total: 2 },
  createdAt: '',
  updatedAt: '',
};
const labels = new Map<string, Label>([
  ['l1', { id: 'l1', boardId: 'b1', name: 'Bug', color: '#f87171' }],
]);
const members = new Map<string, Member>([
  [
    'u1',
    {
      userId: 'u1',
      role: 'MEMBER',
      joinedAt: '',
      user: { id: 'u1', name: 'Ana Lima', username: 'ana', avatarColor: '#fff', email: '' },
    },
  ],
]);

function renderCard(onOpen = vi.fn()) {
  render(
    <DndContext>
      <SortableContext items={['c1']}>
        <ul>
          <CardItem card={card} labels={labels} members={members} onOpen={onOpen} />
        </ul>
      </SortableContext>
    </DndContext>,
  );
  return onOpen;
}

describe('CardItem', () => {
  it('mostra etiquetas, prazo atrasado, checklist, comentários e responsáveis', () => {
    renderCard();
    const item = screen.getByRole('button', { name: 'Corrigir login' });
    expect(item).toHaveTextContent('Bug');
    expect(item).toHaveTextContent('(Atrasado)');
    expect(item).toHaveTextContent('1/2');
    expect(item).toHaveTextContent('3comentários');
    expect(screen.getByRole('img', { name: 'Ana Lima' })).toBeInTheDocument();
  });

  it('abre com clique e com Enter', async () => {
    const onOpen = renderCard();
    // No app o PointerSensor só inicia o arraste após 6px; aqui o clique é direto.
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir login' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Corrigir login' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledWith('c1');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
