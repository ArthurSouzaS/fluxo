'use client';

import { useEffect, useState } from 'react';
import { BOARD_COLORS, updateBoardSchema, type BoardDetail } from '@fluxo/shared';
import { validate, type FieldErrors } from '@/lib/forms';
import { useBoardMutations } from '@/lib/useBoardMutations';
import { Button } from '../ui/Button';
import { TextArea, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import formStyles from '../workspace/CreateBoardDialog.module.scss';

export function BoardSettingsDialog({
  board,
  open,
  onClose,
}: {
  board: BoardDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { updateBoard } = useBoardMutations(board.id);
  const toast = useToast();
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [color, setColor] = useState(board.color);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setTitle(board.title);
    setDescription(board.description ?? '');
    setColor(board.color);
    setErrors({});
  }, [open, board.title, board.description, board.color]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(updateBoardSchema, { title, description, color });
    if (!result.success) return setErrors(result.errors);
    updateBoard.mutate(result.data, {
      onSuccess: () => {
        toast.success('Quadro atualizado');
        onClose();
      },
    });
  };

  const colors: string[] = (BOARD_COLORS as readonly string[]).includes(board.color)
    ? [...BOARD_COLORS]
    : [board.color, ...BOARD_COLORS];

  return (
    <Modal open={open} onClose={onClose} title="Editar quadro">
      <form className={formStyles.form} onSubmit={onSubmit} noValidate>
        <TextInput
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          data-autofocus
        />
        <TextArea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          rows={3}
        />
        <fieldset className={formStyles.fieldset}>
          <legend>Cor</legend>
          <div className={formStyles.colors}>
            {colors.map((option) => (
              <label
                key={option}
                className={formStyles.color}
                style={{ background: option }}
                aria-label={`Cor ${option}`}
              >
                <input
                  type="radio"
                  name="board-color"
                  checked={color === option}
                  onChange={() => setColor(option)}
                  className="visually-hidden"
                />
                <span className="visually-hidden">Cor {option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={formStyles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={updateBoard.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
