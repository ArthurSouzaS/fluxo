'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWorkspaceSchema } from '@fluxo/shared';
import { workspacesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { apiErrors, validate, type FieldErrors } from '@/lib/forms';
import { Button } from '../ui/Button';
import { TextArea, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

export function CreateWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: workspacesApi.create,
    onSuccess: (workspace) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      toast.success('Workspace criado!');
      onClose();
      setName('');
      setDescription('');
      router.push(`/workspace?id=${workspace.id}`);
    },
    onError: (error) => setErrors(apiErrors(error)),
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(createWorkspaceSchema, { name, description });
    if (!result.success) return setErrors(result.errors);
    setErrors({});
    mutation.mutate(result.data);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo workspace"
      description="Um espaço para sua equipe, com membros e quadros."
      size="sm"
    >
      <form onSubmit={onSubmit} noValidate style={{ display: 'grid', gap: 14 }}>
        {errors._form ? (
          <p role="alert" style={{ color: 'var(--red-text)' }}>
            {errors._form}
          </p>
        ) : null}
        <TextInput
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          data-autofocus
          placeholder="Ex.: Projeto Integrador"
        />
        <TextArea
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          rows={3}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            Criar workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
