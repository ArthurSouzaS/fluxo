'use client';

import { memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardSummary, Label, Member } from '@fluxo/shared';
import { dueStatus, formatShortDate } from '@/lib/format';
import { AvatarGroup } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { LabelChip } from '../ui/LabelChip';
import styles from './CardItem.module.scss';

interface CardItemProps {
  card: CardSummary;
  labels: Map<string, Label>;
  members: Map<string, Member>;
  onOpen: (cardId: string) => void;
  disabled?: boolean;
}

const DUE_LABEL = {
  overdue: 'Atrasado',
  soon: 'Vence em breve',
  later: 'Prazo',
  done: 'Concluído',
} as const;

export function CardContent({ card, labels, members }: Omit<CardItemProps, 'onOpen' | 'disabled'>) {
  const cardLabels = card.labelIds
    .map((id) => labels.get(id))
    .filter((label): label is Label => !!label);
  const assignees = card.assigneeIds.map((id) => members.get(id)?.user).filter((user) => !!user);
  const due = card.dueDate ? dueStatus(card.dueDate, card.completedAt) : null;
  const hasMeta =
    due ||
    card.hasDescription ||
    card.commentCount ||
    card.attachmentCount ||
    card.checklist.total ||
    assignees.length;

  return (
    <>
      {cardLabels.length ? (
        <span className={styles.labels}>
          {cardLabels.map((label) => (
            <LabelChip key={label.id} name={label.name} color={label.color} />
          ))}
        </span>
      ) : null}
      <span
        className={[styles.title, card.completedAt && styles.completed].filter(Boolean).join(' ')}
      >
        {card.title}
      </span>
      {hasMeta ? (
        <span className={styles.meta}>
          {due && card.dueDate ? (
            <span className={[styles.badge, styles[`due-${due}`]].join(' ')} title={DUE_LABEL[due]}>
              <Icon name={due === 'done' ? 'check' : 'clock'} size={12} />
              {formatShortDate(card.dueDate)}
              <span className="visually-hidden">({DUE_LABEL[due]})</span>
            </span>
          ) : null}
          {card.checklist.total ? (
            <span
              className={[
                styles.badge,
                card.checklist.done === card.checklist.total && styles.checkDone,
              ]
                .filter(Boolean)
                .join(' ')}
              title="Checklist"
            >
              <Icon name="checklist" size={12} />
              {card.checklist.done}/{card.checklist.total}
            </span>
          ) : null}
          {card.hasDescription ? (
            <span className={styles.icon} title="Tem descrição">
              <Icon name="text" size={12} label="Tem descrição" />
            </span>
          ) : null}
          {card.commentCount ? (
            <span className={styles.icon} title="Comentários">
              <Icon name="comment" size={12} />
              {card.commentCount}
              <span className="visually-hidden">comentários</span>
            </span>
          ) : null}
          {card.attachmentCount ? (
            <span className={styles.icon} title="Anexos">
              <Icon name="paperclip" size={12} />
              {card.attachmentCount}
              <span className="visually-hidden">anexos</span>
            </span>
          ) : null}
          {assignees.length ? (
            <span className={styles.assignees}>
              <AvatarGroup users={assignees} max={3} size={22} />
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

function CardItemBase({ card, labels, members, onOpen, disabled }: CardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
    disabled: disabled || card.id.startsWith('temp-'),
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={styles.item}
    >
      <div
        className={[styles.card, isDragging && styles.dragging].filter(Boolean).join(' ')}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-roledescription="cartão arrastável"
        aria-label={card.title}
        data-card-id={card.id}
        onClick={() => onOpen(card.id)}
        onKeyDown={(event) => {
          // Enter abre o cartão; Espaço pega/solta para arrastar.
          if (event.key === 'Enter' && !isDragging) {
            event.preventDefault();
            onOpen(card.id);
            return;
          }
          listeners?.onKeyDown?.(event);
        }}
      >
        <CardContent card={card} labels={labels} members={members} />
      </div>
    </li>
  );
}

export const CardItem = memo(CardItemBase);
