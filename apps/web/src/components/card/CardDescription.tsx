'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Markdown } from '../ui/Markdown';
import styles from './CardModal.module.scss';

interface CardDescriptionProps {
  value: string;
  canEdit: boolean;
  saving: boolean;
  onSave: (value: string) => void;
}

/** Descrição em Markdown com abas Escrever/Visualizar. */
export function CardDescription({ value, canEdit, saving, onSave }: CardDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const save = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  return (
    <section className={styles.section} aria-labelledby="card-description">
      <div className={styles.sectionHeader}>
        <h3 id="card-description" className={styles.sectionTitle}>
          <Icon name="text" size={16} /> Descrição
        </h3>
        {canEdit && !editing && value ? (
          <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)}>
            Editar
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className={styles.editor}>
          <div role="tablist" aria-label="Modo do editor" className={styles.tabs}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'write'}
              onClick={() => setTab('write')}
            >
              Escrever
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preview'}
              onClick={() => setTab('preview')}
            >
              Visualizar
            </button>
          </div>
          {tab === 'write' ? (
            <textarea
              className={styles.textarea}
              aria-label="Descrição em Markdown"
              value={draft}
              maxLength={20000}
              rows={10}
              ref={(element) => element?.focus()}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) save();
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setDraft(value);
                  setEditing(false);
                }
              }}
              placeholder="Use **negrito**, listas, `código`, [links](https://...) e - [ ] tarefas"
            />
          ) : (
            <div className={styles.preview}>
              {draft.trim() ? (
                <Markdown>{draft}</Markdown>
              ) : (
                <p className={styles.muted}>Nada para visualizar.</p>
              )}
            </div>
          )}
          <div className={styles.editorActions}>
            <Button size="sm" variant="primary" onClick={save} loading={saving}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <span className={styles.hint}>Markdown suportado · Ctrl+Enter salva</span>
          </div>
        </div>
      ) : value.trim() ? (
        <Markdown>{value}</Markdown>
      ) : canEdit ? (
        <button type="button" className={styles.placeholder} onClick={() => setEditing(true)}>
          Adicionar uma descrição mais detalhada...
        </button>
      ) : (
        <p className={styles.muted}>Sem descrição.</p>
      )}
    </section>
  );
}
