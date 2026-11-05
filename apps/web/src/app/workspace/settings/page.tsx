'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { can, updateWorkspaceSchema } from '@fluxo/shared';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, errorMessage, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { MembersManager } from '@/components/workspace/MembersManager';
import styles from '@/components/workspace/Settings.module.scss';
import { workspacesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { apiErrors, validate, type FieldErrors } from '@/lib/forms';

function WorkspaceSettings() {
  const id = useSearchParams().get('id') ?? '';
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const workspace = useQuery({
    queryKey: queryKeys.workspace(id),
    queryFn: () => workspacesApi.get(id),
    enabled: !!id,
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    if (!workspace.data) return;
    setName(workspace.data.name);
    setDescription(workspace.data.description ?? '');
  }, [workspace.data]);

  const update = useMutation({
    mutationFn: () => workspacesApi.update(id, { name, description }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.workspace(id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      toast.success('Workspace atualizado');
    },
    onError: (error) => setErrors(apiErrors(error)),
  });

  const remove = useMutation({
    mutationFn: () => workspacesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      toast.success('Workspace excluído');
      router.replace('/app');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const ws = workspace.data;
  const crumbs = [
    { label: 'Workspaces', href: '/app' },
    { label: ws?.name ?? '...', href: `/workspace?id=${id}` },
    { label: 'Configurações' },
  ];

  if (workspace.isError) {
    return (
      <AppShell crumbs={crumbs}>
        <ErrorState error={workspace.error} onRetry={() => workspace.refetch()} />
      </AppShell>
    );
  }

  return (
    <AppShell crumbs={crumbs}>
      <PageHeader title="Configurações do workspace" description={ws?.name} />
      {!ws ? (
        <Skeleton height={200} radius={12} />
      ) : (
        <>
          {can(ws.role, 'workspace:update') ? (
            <section className={styles.card} aria-labelledby="general-title">
              <h2 id="general-title" className={styles.cardTitle}>
                Geral
              </h2>
              <p className={styles.cardDescription}>
                Nome e descrição exibidos para todos os membros.
              </p>
              <form
                className={styles.form}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  const result = validate(updateWorkspaceSchema, { name, description });
                  if (!result.success) return setErrors(result.errors);
                  setErrors({});
                  update.mutate();
                }}
              >
                <TextInput
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                />
                <TextArea
                  label="Descrição"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  error={errors.description}
                  rows={3}
                />
                <div className={styles.formActions}>
                  <Button type="submit" variant="primary" loading={update.isPending}>
                    Salvar alterações
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <MembersManager workspace={ws} onLeft={() => router.replace('/app')} />

          {can(ws.role, 'workspace:delete') ? (
            <section
              className={[styles.card, styles.danger].join(' ')}
              aria-labelledby="danger-title"
            >
              <h2 id="danger-title" className={styles.cardTitle}>
                Zona de perigo
              </h2>
              <p className={styles.cardDescription}>
                Excluir o workspace apaga todos os quadros, cartões e anexos. Não há como desfazer.
              </p>
              <Button variant="danger" icon="trash" onClick={() => setDeleting(true)}>
                Excluir workspace
              </Button>
            </section>
          ) : null}

          <Modal
            open={deleting}
            onClose={() => setDeleting(false)}
            title="Excluir workspace"
            size="sm"
            footer={
              <>
                <Button variant="ghost" onClick={() => setDeleting(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  disabled={confirmName !== ws.name}
                  loading={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  Excluir para sempre
                </Button>
              </>
            }
          >
            <TextInput
              label={`Digite "${ws.name}" para confirmar`}
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              data-autofocus
            />
          </Modal>
        </>
      )}
    </AppShell>
  );
}

export default function WorkspaceSettingsPage() {
  return (
    <Suspense>
      <WorkspaceSettings />
    </Suspense>
  );
}
