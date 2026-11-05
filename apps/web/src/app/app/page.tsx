'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { WorkspaceSection } from '@/components/workspace/WorkspaceSection';
import { workspacesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { useAuth } from '@/lib/auth/AuthProvider';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function WorkspacesPage() {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const workspaces = useQuery({ queryKey: queryKeys.workspaces, queryFn: workspacesApi.list });

  return (
    <AppShell crumbs={[{ label: 'Workspaces' }]}>
      <PageHeader
        title={`${greeting()}, ${user?.name.split(' ')[0] ?? ''}!`}
        description="Seus workspaces e quadros."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            Novo workspace
          </Button>
        }
      />
      {workspaces.isPending ? (
        <div style={{ display: 'grid', gap: 12 }} aria-busy="true">
          <Skeleton height={36} width={260} />
          <Skeleton height={128} radius={12} />
        </div>
      ) : workspaces.isError ? (
        <ErrorState error={workspaces.error} onRetry={() => workspaces.refetch()} />
      ) : workspaces.data.length === 0 ? (
        <EmptyState
          icon="users"
          title="Você ainda não participa de nenhum workspace"
          description="Crie um workspace ou peça para alguém adicionar você pelo seu e-mail."
          action={
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Criar workspace
            </Button>
          }
        />
      ) : (
        workspaces.data.map((workspace) => (
          <WorkspaceSection key={workspace.id} workspace={workspace} />
        ))
      )}
      <CreateWorkspaceDialog open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}
