'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLabelSchema, type BoardDetail, type Label } from '@fluxo/shared';
import { labelsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { validate } from '@/lib/forms';
import { Button, IconButton } from '../ui/Button';
import { LabelChip } from '../ui/LabelChip';
import { Modal } from '../ui/Modal';
import { errorMessage } from '../ui/States';
import { useToast } from '../ui/Toast';
import styles from './LabelsDialog.module.scss';

const LABEL_COLORS = [
  '#f87171',
  '#fb923c',
  '#fbbf24',
  '#34d399',
  '#2dd4bf',
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#94a3b8',
];

/** Cria, renomeia e exclui as etiquetas do quadro. */
export function LabelsDialog({
  board,
  open,
  onClose,
}: {
  board: BoardDetail;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[0]!);
  const [error, setError] = useState<string>();

  const sync = (update: (labels: Label[]) => Label[]) =>
    queryClient.setQueryData<BoardDetail>(queryKeys.board(board.id), (current) =>
      current ? { ...current, labels: update(current.labels) } : current,
    );

  const create = useMutation({
    mutationFn: () => labelsApi.create(board.id, { name: name.trim(), color }),
    onSuccess: (label) => {
      sync((labels) => [...labels.filter((l) => l.id !== label.id), label]);
      setName('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (labelId: string) => labelsApi.remove(labelId),
    onSuccess: (_data, labelId) => {
      sync((labels) => labels.filter((label) => label.id !== labelId));
      void queryClient.invalidateQueries({ queryKey: queryKeys.board(board.id) });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rename = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      labelsApi.update(id, { name: newName }),
    onSuccess: (label) => sync((labels) => labels.map((l) => (l.id === label.id ? label : l))),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(createLabelSchema, { name, color });
    if (!result.success) return setError(Object.values(result.errors)[0]);
    setError(undefined);
    create.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Etiquetas do quadro" size="sm">
      <ul className={styles.list}>
        {board.labels.map((label) => (
          <li key={label.id} className={styles.item}>
            <LabelChip name={label.name} color={label.color} />
            <span className={styles.spacer} />
            <IconButton
              icon="edit"
              size="sm"
              label={`Renomear ${label.name}`}
              onClick={() => {
                const newName = window.prompt('Novo nome da etiqueta:', label.name)?.trim();
                if (newName && newName !== label.name)
                  rename.mutate({ id: label.id, newName: newName.slice(0, 30) });
              }}
            />
            <IconButton
              icon="trash"
              size="sm"
              label={`Excluir ${label.name}`}
              onClick={() => remove.mutate(label.id)}
            />
          </li>
        ))}
        {board.labels.length === 0 ? (
          <li className={styles.empty}>Nenhuma etiqueta ainda.</li>
        ) : null}
      </ul>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <label className="visually-hidden" htmlFor="new-label">
          Nome da nova etiqueta
        </label>
        <input
          id="new-label"
          className={styles.input}
          value={name}
          maxLength={30}
          placeholder="Nova etiqueta"
          onChange={(e) => setName(e.target.value)}
        />
        <div className={styles.colors} role="radiogroup" aria-label="Cor da etiqueta">
          {LABEL_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={color === option}
              aria-label={`Cor ${option}`}
              className={styles.color}
              style={{ background: option }}
              onClick={() => setColor(option)}
            />
          ))}
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" icon="plus" loading={create.isPending}>
          Criar etiqueta
        </Button>
      </form>
    </Modal>
  );
}
