'use client';

import { useEffect, useState } from 'react';
import type { CardDetail } from '@fluxo/shared';
import { useCardActions } from '@/lib/useCardActions';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { InlineComposer } from '../board/InlineComposer';
import styles from './CardModal.module.scss';

/** Checkbox com estado local: responde no mesmo quadro, sem esperar o cache. */
function ItemCheckbox({
  text,
  done,
  disabled,
  onToggle,
}: {
  text: string;
  done: boolean;
  disabled: boolean;
  onToggle: (done: boolean) => void;
}) {
  const [checked, setChecked] = useState(done);
  useEffect(() => setChecked(done), [done]);
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          setChecked(event.target.checked);
          onToggle(event.target.checked);
        }}
      />
      <span className={checked ? styles.itemDone : undefined}>{text}</span>
    </label>
  );
}

export function CardChecklists({
  card,
  boardId,
  canEdit,
}: {
  card: CardDetail;
  boardId: string;
  canEdit: boolean;
}) {
  const actions = useCardActions(card.id, boardId);
  const [adding, setAdding] = useState<string | null>(null);

  if (card.checklists.length === 0) return null;

  return (
    <>
      {card.checklists.map((checklist) => {
        const done = checklist.items.filter((item) => item.done).length;
        const total = checklist.items.length;
        const percent = total ? Math.round((done / total) * 100) : 0;
        return (
          <section
            key={checklist.id}
            className={styles.section}
            aria-labelledby={`checklist-${checklist.id}`}
          >
            <div className={styles.sectionHeader}>
              <h3 id={`checklist-${checklist.id}`} className={styles.sectionTitle}>
                <Icon name="checklist" size={16} /> {checklist.title}
              </h3>
              {canEdit ? (
                <IconButton
                  icon="trash"
                  size="sm"
                  label={`Excluir checklist ${checklist.title}`}
                  onClick={() => actions.removeChecklist.mutate(checklist.id)}
                />
              ) : null}
            </div>
            <div className={styles.progress}>
              <span className={styles.progressValue}>{percent}%</span>
              <div
                className={styles.progressBar}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progresso de ${checklist.title}: ${done} de ${total}`}
              >
                <span
                  style={{ width: `${percent}%` }}
                  className={percent === 100 ? styles.progressDone : undefined}
                />
              </div>
            </div>
            <ul className={styles.items}>
              {checklist.items.map((item) => (
                <li key={item.id} className={styles.checkItem}>
                  <ItemCheckbox
                    text={item.text}
                    done={item.done}
                    disabled={!canEdit}
                    onToggle={(done) => actions.toggleItem(item.id, done)}
                  />
                  {canEdit ? (
                    <span className={styles.itemActions}>
                      <IconButton
                        icon="edit"
                        size="sm"
                        label={`Editar item ${item.text}`}
                        onClick={() => {
                          const text = window.prompt('Editar item:', item.text)?.trim();
                          if (text && text !== item.text)
                            actions.editItem.mutate({ itemId: item.id, text: text.slice(0, 300) });
                        }}
                      />
                      <IconButton
                        icon="x"
                        size="sm"
                        label={`Remover item ${item.text}`}
                        onClick={() => actions.removeItem.mutate(item.id)}
                      />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              adding === checklist.id ? (
                <InlineComposer
                  label="Texto do novo item"
                  placeholder="Novo item..."
                  submitLabel="Adicionar"
                  maxLength={300}
                  keepOpen
                  onSubmit={(text) => actions.addItem.mutate({ checklistId: checklist.id, text })}
                  onCancel={() => setAdding(null)}
                />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="plus"
                  onClick={() => setAdding(checklist.id)}
                >
                  Adicionar item
                </Button>
              )
            ) : null}
          </section>
        );
      })}
    </>
  );
}
