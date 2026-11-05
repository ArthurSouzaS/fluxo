'use client';

import { useRef } from 'react';
import { can, type BoardDetail, type CardDetail } from '@fluxo/shared';
import { formatFullDate, fromDateInput, toDateInput } from '@/lib/format';
import { sortedColumns } from '@/lib/board-state';
import { useBoardMutations } from '@/lib/useBoardMutations';
import { useCardActions } from '@/lib/useCardActions';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { LabelChip } from '../ui/LabelChip';
import { Popover } from '../ui/Popover';
import styles from './CardModal.module.scss';

interface CardSidebarProps {
  card: CardDetail;
  board: BoardDetail;
  onRequestDelete: () => void;
  onArchived: () => void;
}

export function CardSidebar({ card, board, onRequestDelete, onArchived }: CardSidebarProps) {
  const actions = useCardActions(card.id, board.id);
  const { updateCard } = useBoardMutations(board.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = can(board.myRole, 'card:write');
  const columns = sortedColumns(board);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <aside className={styles.sidebar} aria-label="Detalhes do cartão">
      <section className={styles.sideSection}>
        <h3 className={styles.sideTitle}>Coluna</h3>
        {canEdit ? (
          <select
            className={styles.sideSelect}
            aria-label="Mover para a coluna"
            value={card.columnId}
            onChange={(event) =>
              actions.move.mutate({ columnId: event.target.value, index: Number.MAX_SAFE_INTEGER })
            }
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.title}
              </option>
            ))}
          </select>
        ) : (
          <p>{card.columnTitle}</p>
        )}
      </section>

      <section className={styles.sideSection}>
        <h3 className={styles.sideTitle}>Responsáveis</h3>
        <ul className={styles.people}>
          {card.assignees.map((user) => (
            <li key={user.id}>
              <Avatar user={user} size={24} labelled={false} /> {user.name}
            </li>
          ))}
          {card.assignees.length === 0 ? <li className={styles.muted}>Ninguém</li> : null}
        </ul>
        {canEdit ? (
          <Popover
            label="Escolher responsáveis"
            trigger={(props) => (
              <Button size="sm" variant="ghost" icon="user" {...props}>
                Alterar responsáveis
              </Button>
            )}
          >
            {() => (
              <div className={styles.pickList}>
                {board.members.map((member) => (
                  <label key={member.userId} className={styles.pickItem}>
                    <input
                      type="checkbox"
                      checked={card.assigneeIds.includes(member.userId)}
                      onChange={() =>
                        actions.setAssignees.mutate(toggle(card.assigneeIds, member.userId))
                      }
                    />
                    <Avatar user={member.user} size={22} labelled={false} />
                    <span>{member.user.name}</span>
                  </label>
                ))}
              </div>
            )}
          </Popover>
        ) : null}
      </section>

      <section className={styles.sideSection}>
        <h3 className={styles.sideTitle}>Etiquetas</h3>
        <div className={styles.labels}>
          {card.labels.map((label) => (
            <LabelChip key={label.id} name={label.name} color={label.color} />
          ))}
          {card.labels.length === 0 ? <span className={styles.muted}>Nenhuma</span> : null}
        </div>
        {canEdit ? (
          <Popover
            label="Escolher etiquetas"
            trigger={(props) => (
              <Button size="sm" variant="ghost" icon="tag" {...props}>
                Alterar etiquetas
              </Button>
            )}
          >
            {() => (
              <div className={styles.pickList}>
                {board.labels.map((label) => (
                  <label key={label.id} className={styles.pickItem}>
                    <input
                      type="checkbox"
                      checked={card.labelIds.includes(label.id)}
                      onChange={() => actions.setLabels.mutate(toggle(card.labelIds, label.id))}
                    />
                    <LabelChip name={label.name} color={label.color} />
                  </label>
                ))}
                {board.labels.length === 0 ? (
                  <p className={styles.muted}>Crie etiquetas no menu do quadro.</p>
                ) : null}
              </div>
            )}
          </Popover>
        ) : null}
      </section>

      <section className={styles.sideSection}>
        <h3 className={styles.sideTitle}>
          <label htmlFor={`due-${card.id}`}>Prazo</label>
        </h3>
        {canEdit ? (
          <div className={styles.dueRow}>
            <input
              id={`due-${card.id}`}
              type="date"
              className={styles.sideSelect}
              value={toDateInput(card.dueDate)}
              onChange={(event) =>
                updateCard.mutate({
                  cardId: card.id,
                  input: { dueDate: fromDateInput(event.target.value) },
                })
              }
            />
            {card.dueDate ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateCard.mutate({ cardId: card.id, input: { dueDate: null } })}
              >
                Remover
              </Button>
            ) : null}
          </div>
        ) : (
          <p>{card.dueDate ? formatFullDate(card.dueDate) : 'Sem prazo'}</p>
        )}
        {card.completedAt ? (
          <p className={styles.completed}>Concluído em {formatFullDate(card.completedAt)}</p>
        ) : null}
      </section>

      {canEdit ? (
        <section className={styles.sideSection}>
          <h3 className={styles.sideTitle}>Ações</h3>
          <div className={styles.sideActions}>
            <Button
              size="sm"
              icon="checklist"
              onClick={() => {
                const title = window.prompt('Título do checklist:', 'Checklist')?.trim();
                if (title) actions.addChecklist.mutate(title.slice(0, 100));
              }}
            >
              Adicionar checklist
            </Button>
            <Button
              size="sm"
              icon="paperclip"
              loading={actions.upload.isPending}
              onClick={() => fileRef.current?.click()}
            >
              Anexar arquivo
            </Button>
            <input
              ref={fileRef}
              type="file"
              hidden
              aria-label="Escolher arquivo para anexar"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) actions.upload.mutate(file);
                event.target.value = '';
              }}
            />
            <Button
              size="sm"
              icon="archive"
              onClick={() =>
                updateCard.mutate(
                  { cardId: card.id, input: { archived: true } },
                  { onSuccess: onArchived },
                )
              }
            >
              Arquivar
            </Button>
            <Button
              size="sm"
              icon="trash"
              variant="ghost"
              className={styles.danger}
              onClick={onRequestDelete}
            >
              Excluir
            </Button>
          </div>
        </section>
      ) : null}

      <p className={styles.createdBy}>
        Criado {card.createdBy ? `por ${card.createdBy.name}` : ''} em{' '}
        {formatFullDate(card.createdAt)}
      </p>
    </aside>
  );
}
