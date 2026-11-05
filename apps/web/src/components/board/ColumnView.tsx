'use client';

import { useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardSummary, Column, Label, Member } from '@fluxo/shared';
import { Button, IconButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { CardItem } from './CardItem';
import { InlineComposer } from './InlineComposer';
import styles from './ColumnView.module.scss';

export const columnDndId = (id: string) => `col:${id}`;

interface ColumnViewProps {
  column: Column;
  cards: CardSummary[];
  /** Total real de cartões (os filtros podem esconder alguns). */
  totalCount: number;
  /** Há filtros ativos (mostra visíveis/total). */
  filtered: boolean;
  labels: Map<string, Label>;
  members: Map<string, Member>;
  canEdit: boolean;
  dragDisabled: boolean;
  composerOpen: boolean;
  onComposerChange: (open: boolean) => void;
  onOpenCard: (cardId: string) => void;
  onCreateCard: (title: string) => void;
  onUpdate: (input: { title?: string; isDone?: boolean; wipLimit?: number | null }) => void;
  onDelete: () => void;
}

export function ColumnView(props: ColumnViewProps) {
  const {
    column,
    cards,
    totalCount,
    labels,
    members,
    canEdit,
    dragDisabled,
    composerOpen,
    onComposerChange,
  } = props;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [confirming, setConfirming] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnDndId(column.id),
    data: { type: 'column' },
    disabled: dragDisabled,
  });

  const overLimit = column.wipLimit !== null && totalCount > column.wipLimit;

  const saveTitle = () => {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== column.title) props.onUpdate({ title: trimmed });
    else setTitle(column.title);
  };

  const askWipLimit = () => {
    const value = window.prompt(
      'Limite de cartões em andamento (deixe vazio para remover):',
      column.wipLimit?.toString() ?? '',
    );
    if (value === null) return;
    const parsed = Number.parseInt(value, 10);
    props.onUpdate({
      wipLimit:
        value.trim() === ''
          ? null
          : Number.isFinite(parsed) && parsed > 0
            ? Math.min(parsed, 99)
            : column.wipLimit,
    });
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={[styles.column, isDragging && styles.dragging, overLimit && styles.overLimit]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={`column-${column.id}`}
      data-column-id={column.id}
    >
      <header className={styles.header}>
        {canEdit && !dragDisabled ? (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className={styles.handle}
            aria-label={`Mover coluna ${column.title}`}
            {...attributes}
            {...listeners}
          >
            <Icon name="grip" size={14} />
          </button>
        ) : null}
        {editing ? (
          <input
            className={styles.titleInput}
            value={title}
            maxLength={60}
            aria-label="Título da coluna"
            ref={(element) => element?.focus()}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveTitle();
              if (event.key === 'Escape') {
                setTitle(column.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h2 id={`column-${column.id}`} className={styles.title}>
            {canEdit ? (
              <button
                type="button"
                className={styles.titleButton}
                onClick={() => setEditing(true)}
                title="Renomear coluna"
              >
                {column.title}
              </button>
            ) : (
              column.title
            )}
          </h2>
        )}
        {column.isDone ? (
          <span className={styles.done} title="Cartões aqui contam como concluídos">
            <Icon name="check" size={12} label="Coluna de concluídos" />
          </span>
        ) : null}
        <span
          className={styles.count}
          aria-label={`${totalCount} cartões${column.wipLimit ? `, limite ${column.wipLimit}` : ''}`}
        >
          {props.filtered ? `${cards.length}/` : ''}
          {totalCount}
          {column.wipLimit ? ` / ${column.wipLimit}` : ''}
        </span>
        {canEdit ? (
          <Menu
            items={[
              { label: 'Renomear', icon: 'edit', onSelect: () => setEditing(true) },
              {
                label: column.isDone
                  ? 'Desmarcar como concluída'
                  : 'Marcar como coluna de concluídos',
                icon: 'check',
                onSelect: () => props.onUpdate({ isDone: !column.isDone }),
              },
              { label: 'Definir limite WIP', icon: 'filter', onSelect: askWipLimit },
              {
                label: 'Excluir coluna',
                icon: 'trash',
                danger: true,
                onSelect: () => setConfirming(true),
              },
            ]}
            trigger={(triggerProps) => (
              <IconButton
                icon="more"
                label={`Ações da coluna ${column.title}`}
                size="sm"
                {...triggerProps}
              />
            )}
          />
        ) : null}
      </header>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <ul className={styles.cards} aria-label={`Cartões em ${column.title}`}>
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              labels={labels}
              members={members}
              onOpen={props.onOpenCard}
              disabled={dragDisabled}
            />
          ))}
          {cards.length === 0 && !composerOpen ? (
            <li className={styles.empty} aria-hidden={canEdit}>
              {totalCount > 0
                ? 'Nenhum cartão corresponde aos filtros'
                : canEdit
                  ? 'Arraste cartões para cá'
                  : 'Sem cartões'}
            </li>
          ) : null}
        </ul>
      </SortableContext>

      {canEdit ? (
        <div className={styles.footer}>
          {composerOpen ? (
            <InlineComposer
              label={`Título do novo cartão em ${column.title}`}
              placeholder="Título do cartão..."
              submitLabel="Adicionar"
              keepOpen
              onSubmit={props.onCreateCard}
              onCancel={() => onComposerChange(false)}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon="plus"
              block
              className={styles.add}
              onClick={() => onComposerChange(true)}
            >
              Adicionar cartão
            </Button>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Excluir coluna?"
        description={
          totalCount
            ? `A coluna "${column.title}" e os ${totalCount} cartões dela serão excluídos permanentemente.`
            : `A coluna "${column.title}" será excluída.`
        }
        confirmLabel="Excluir"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          props.onDelete();
        }}
      />
    </section>
  );
}
