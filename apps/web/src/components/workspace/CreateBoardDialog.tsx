'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BOARD_COLORS, createBoardSchema, type BoardTemplate } from '@fluxo/shared';
import { boardsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { apiErrors, validate, type FieldErrors } from '@/lib/forms';
import { Button } from '../ui/Button';
import { TextArea, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import styles from './CreateBoardDialog.module.scss';

const TEMPLATES: Array<{ value: BoardTemplate; label: string; description: string }> = [
  { value: 'kanban', label: 'Kanban', description: 'A fazer · Em andamento · Concluído' },
  {
    value: 'scrum',
    label: 'Sprint',
    description: 'Backlog · A fazer · Em andamento · Em revisão · Concluído',
  },
  { value: 'blank', label: 'Em branco', description: 'Comece do zero' },
];

export function CreateBoardDialog({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(BOARD_COLORS[0]);
  const [template, setTemplate] = useState<BoardTemplate>('kanban');
  const [errors, setErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof boardsApi.create>[1]) =>
      boardsApi.create(workspaceId, input),
    onSuccess: (board) => {
      queryClient.setQueryData(queryKeys.board(board.id), board);
      void queryClient.invalidateQueries({ queryKey: ['boards', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      toast.success('Quadro criado!');
      onClose();
      router.push(`/board?id=${board.id}`);
    },
    onError: (error) => setErrors(apiErrors(error)),
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(createBoardSchema, { title, description, color, template });
    if (!result.success) return setErrors(result.errors);
    setErrors({});
    mutation.mutate(result.data);
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo quadro" size="md">
      <form onSubmit={onSubmit} noValidate className={styles.form}>
        {errors._form ? (
          <p role="alert" className={styles.error}>
            {errors._form}
          </p>
        ) : null}
        <TextInput
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          data-autofocus
          placeholder="Ex.: Sprint 13"
        />
        <TextArea
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          rows={2}
        />

        <fieldset className={styles.fieldset}>
          <legend>Cor</legend>
          <div className={styles.colors}>
            {BOARD_COLORS.map((option) => (
              <label
                key={option}
                className={styles.color}
                style={{ background: option }}
                aria-label={`Cor ${option}`}
              >
                <input
                  type="radio"
                  name="color"
                  value={option}
                  checked={color === option}
                  onChange={() => setColor(option)}
                  className="visually-hidden"
                />
                <span className="visually-hidden">Cor {option}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Modelo</legend>
          <div className={styles.templates}>
            {TEMPLATES.map((option) => (
              <label key={option.value} className={styles.template}>
                <input
                  type="radio"
                  name="template"
                  value={option.value}
                  checked={template === option.value}
                  onChange={() => setTemplate(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            Criar quadro
          </Button>
        </div>
      </form>
    </Modal>
  );
}
