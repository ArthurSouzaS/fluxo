'use client';

import { useMemo, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  closestCenter,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { can, type BoardDetail, type CardSummary } from '@fluxo/shared';
import {
  cardsByColumn,
  filterCards,
  hasActiveFilters,
  sortedColumns,
  type BoardFilters,
} from '@/lib/board-state';
import { useBoardMutations } from '@/lib/useBoardMutations';
import { InlineComposer } from './InlineComposer';
import { CardContent } from './CardItem';
import cardStyles from './CardItem.module.scss';
import { columnDndId, ColumnView } from './ColumnView';
import { Button } from '../ui/Button';
import styles from './BoardCanvas.module.scss';

type Containers = Record<string, string[]>;

const isColumnId = (id: string) => id.startsWith('col:');
const fromColumnId = (id: string) => id.slice(4);

interface BoardCanvasProps {
  board: BoardDetail;
  filters: BoardFilters;
  composerColumnId: string | null;
  onComposerChange: (columnId: string | null) => void;
  onOpenCard: (cardId: string) => void;
}

export function BoardCanvas({
  board,
  filters,
  composerColumnId,
  onComposerChange,
  onOpenCard,
}: BoardCanvasProps) {
  const mutations = useBoardMutations(board.id);
  const canEdit = can(board.myRole, 'card:write');
  const filtering = hasActiveFilters(filters);
  const dragDisabled = !canEdit || filtering;
  const [addingColumn, setAddingColumn] = useState(false);

  const columns = useMemo(() => sortedColumns(board), [board]);
  const grouped = useMemo(() => cardsByColumn(board.cards), [board.cards]);
  const visible = useMemo(
    () => cardsByColumn(filterCards(board.cards, filters)),
    [board.cards, filters],
  );
  const labels = useMemo(
    () => new Map(board.labels.map((label) => [label.id, label])),
    [board.labels],
  );
  const members = useMemo(
    () => new Map(board.members.map((member) => [member.userId, member])),
    [board.members],
  );
  const cardsById = useMemo(
    () => new Map(board.cards.map((card) => [card.id, card])),
    [board.cards],
  );

  // Durante o arraste, a ordem fica em estado local; ao soltar, vai para o cache (otimista).
  const [dragging, setDragging] = useState<{ type: 'card' | 'column'; id: string } | null>(null);
  const [containers, setContainers] = useState<Containers | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);

  const baseContainers = useMemo<Containers>(
    () =>
      Object.fromEntries(
        columns.map((column) => [column.id, (grouped.get(column.id) ?? []).map((card) => card.id)]),
      ),
    [columns, grouped],
  );
  const currentContainers = containers ?? baseContainers;
  const orderedColumns = columnOrder
    ? columnOrder.map((id) => columns.find((column) => column.id === id)!).filter(Boolean)
    : columns;

  // Teclado: ←/→ leva o cartão para a coluna vizinha; ↑/↓ reordena (padrão do dnd-kit).
  const keyboardState = useRef({ containers: currentContainers, columns: orderedColumns });
  keyboardState.current = { containers: currentContainers, columns: orderedColumns };
  const coordinateGetter = useRef<KeyboardCoordinateGetter>((event, args) => {
    const activeId = String(args.active);
    const horizontal = event.code === 'ArrowRight' || event.code === 'ArrowLeft';
    if (horizontal && !isColumnId(activeId)) {
      const { containers: source, columns: cols } = keyboardState.current;
      const from = Object.keys(source).find((columnId) => source[columnId]!.includes(activeId));
      const index = cols.findIndex((column) => column.id === from);
      const next = cols[index + (event.code === 'ArrowRight' ? 1 : -1)];
      const element = next && document.querySelector(`[data-column-id="${next.id}"] ul`);
      const rect = args.context.collisionRect;
      if (element && rect) {
        event.preventDefault();
        const target = element.getBoundingClientRect();
        return { x: target.left + (target.width - rect.width) / 2, y: target.top + 8 };
      }
      return undefined;
    }
    return sortableKeyboardCoordinates(event, args);
  }).current;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const findContainer = (id: string, source: Containers = currentContainers) => {
    if (isColumnId(id)) return fromColumnId(id);
    return Object.keys(source).find((columnId) => source[columnId]!.includes(id));
  };

  const collisionDetection: CollisionDetection = (args) => {
    if (dragging?.type === 'column') {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
          isColumnId(String(container.id)),
        ),
      });
    }
    return closestCorners(args);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    if (isColumnId(id)) {
      setDragging({ type: 'column', id });
      setColumnOrder(columns.map((column) => column.id));
    } else {
      setDragging({ type: 'card', id });
      setContainers(baseContainers);
    }
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || dragging?.type !== 'card') return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setContainers((prev) => {
      const source = prev ?? baseContainers;
      const from = findContainer(activeId, source);
      const to = findContainer(overId, source);
      if (!from || !to || from === to) return prev;
      const fromItems = source[from]!.filter((id) => id !== activeId);
      const toItems = source[to]!.slice();
      const overIndex = toItems.indexOf(overId);
      const insertAt = isColumnId(overId) || overIndex === -1 ? toItems.length : overIndex;
      toItems.splice(insertAt, 0, activeId);
      return { ...source, [from]: fromItems, [to]: toItems };
    });
  };

  const reset = () => {
    setDragging(null);
    setContainers(null);
    setColumnOrder(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const activeId = String(active.id);
    if (!over) return reset();
    const overId = String(over.id);

    if (dragging?.type === 'column' && columnOrder) {
      const from = columnOrder.indexOf(fromColumnId(activeId));
      const to = columnOrder.indexOf(fromColumnId(overId));
      if (from !== -1 && to !== -1 && from !== to) {
        mutations.moveColumn.mutate({ columnId: fromColumnId(activeId), index: to });
      }
      return reset();
    }

    const finalContainers = { ...currentContainers };
    const columnId = findContainer(activeId, finalContainers);
    const overColumn = findContainer(overId, finalContainers);
    if (!columnId) return reset();
    let items = finalContainers[columnId]!;
    if (overColumn === columnId && !isColumnId(overId)) {
      const from = items.indexOf(activeId);
      const to = items.indexOf(overId);
      if (from !== to) items = arrayMove(items, from, to);
    }
    const index = items.indexOf(activeId);
    const original = cardsById.get(activeId);
    const originalIndex = baseContainers[original?.columnId ?? '']?.indexOf(activeId);
    if (original && (original.columnId !== columnId || originalIndex !== index)) {
      mutations.moveCard.mutate({ cardId: activeId, columnId, index });
    }
    reset();
  };

  const titleOf = (id: string) =>
    isColumnId(id)
      ? `coluna ${columns.find((c) => c.id === fromColumnId(id))?.title ?? ''}`
      : `cartão ${cardsById.get(id)?.title ?? ''}`;
  const placeOf = (id: string | undefined) => {
    if (!id) return 'fora de uma área válida';
    const columnId = findContainer(id);
    const column = columns.find((c) => c.id === columnId);
    if (!column) return '';
    if (isColumnId(id)) return `na coluna ${column.title}`;
    const position = (currentContainers[column.id]?.indexOf(id) ?? 0) + 1;
    return `na coluna ${column.title}, posição ${position}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou o ${titleOf(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      `${titleOf(String(active.id))} está ${placeOf(over ? String(over.id) : undefined)}.`,
    onDragEnd: ({ active, over }) =>
      `Soltou o ${titleOf(String(active.id))} ${placeOf(over ? String(over.id) : undefined)}.`,
    onDragCancel: ({ active }) =>
      `Movimento cancelado. O ${titleOf(String(active.id))} voltou ao lugar.`,
  };

  const cardsFor = (columnId: string): CardSummary[] => {
    if (containers && dragging?.type === 'card') {
      return (containers[columnId] ?? []).map((id) => cardsById.get(id)!).filter(Boolean);
    }
    return filtering ? (visible.get(columnId) ?? []) : (grouped.get(columnId) ?? []);
  };

  const activeCard = dragging?.type === 'card' ? cardsById.get(dragging.id) : undefined;
  const activeColumn =
    dragging?.type === 'column'
      ? columns.find((c) => c.id === fromColumnId(dragging.id))
      : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'Para pegar um item, pressione Espaço ou Enter. Use as setas para mover e pressione Espaço ou Enter de novo para soltar, ou Esc para cancelar.',
        },
      }}
    >
      <div className={styles.canvas} role="region" aria-label={`Quadro ${board.title}`}>
        <SortableContext
          items={orderedColumns.map((column) => columnDndId(column.id))}
          strategy={horizontalListSortingStrategy}
        >
          {orderedColumns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              cards={cardsFor(column.id)}
              totalCount={grouped.get(column.id)?.length ?? 0}
              filtered={filtering}
              labels={labels}
              members={members}
              canEdit={canEdit}
              dragDisabled={dragDisabled}
              composerOpen={composerColumnId === column.id}
              onComposerChange={(open) => onComposerChange(open ? column.id : null)}
              onOpenCard={onOpenCard}
              onCreateCard={(title) =>
                mutations.createCard.mutate({ columnId: column.id, input: { title } })
              }
              onUpdate={(input) => mutations.updateColumn.mutate({ columnId: column.id, input })}
              onDelete={() => mutations.deleteColumn.mutate(column.id)}
            />
          ))}
        </SortableContext>

        {can(board.myRole, 'column:manage') ? (
          <div className={styles.addColumn}>
            {addingColumn ? (
              <InlineComposer
                label="Título da nova coluna"
                placeholder="Título da coluna..."
                submitLabel="Criar coluna"
                maxLength={60}
                onSubmit={(title) => mutations.createColumn.mutate(title)}
                onCancel={() => setAddingColumn(false)}
              />
            ) : (
              <Button icon="plus" block onClick={() => setAddingColumn(true)}>
                Nova coluna
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
        {activeCard ? (
          <div className={[cardStyles.card, cardStyles.overlay].join(' ')}>
            <CardContent card={activeCard} labels={labels} members={members} />
          </div>
        ) : activeColumn ? (
          <div className={styles.columnGhost}>{activeColumn.title}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
