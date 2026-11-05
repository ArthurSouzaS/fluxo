'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { can, ROLE_LABELS } from '@fluxo/shared';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { BoardGrid } from '@/components/workspace/BoardGrid';
import { CreateBoardDialog } from '@/components/workspace/CreateBoardDialog';
import { boardsApi, workspacesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';

function WorkspaceContent() {
  const id = useSearchParams().get('id') ?? '';
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const workspace = useQuery({
    queryKey: queryKeys.workspace(id),
    queryFn: () => workspacesApi.get(id),
    enabled: !!id,
  });
  const boards = useQuery({
    queryKey: queryKeys.boards(id, showArchived),
    queryFn: () => boardsApi.list(id, showArchived),
    enabled: !!id,
  });

  if (workspace.isError) {
    return (
      <AppShell crumbs={[{ label: 'Workspaces', href: '/app' }, { label: 'Workspace' }]}>
        <ErrorState error={workspace.error} onRetry={() => workspace.refetch()} />
      </AppShell>
    );
  }

  const ws = workspace.data;
  const canCreate = ws ? can(ws.role, 'board:create') : false;

  return (
    <AppShell crumbs={[{ label: 'Workspaces', href: '/app' }, { label: ws?.name ?? '...' }]}>
      {ws ? (
        <PageHeader
          title={ws.name}
          description={`${ws.description ? `${ws.description} · ` : ''}${ROLE_LABELS[ws.role]} · ${ws.memberCount} membros`}
          actions={
            <>
              <Link href={`/workspace/settings?id=${ws.id}`} className={buttonClassName()}>
                <Icon name="settings" size={16} />
                Configurações e membros
              </Link>
              {canCreate ? (
                <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                  Novo quadro
                </Button>
              ) : null}
            </>
          }
        />
      ) : (
        <Skeleton height={60} width={320} />
      )}

      <div
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
        role="group"
        aria-label="Filtrar quadros"
      >
        <Button
          size="sm"
          variant={showArchived ? 'ghost' : 'secondary'}
          aria-pressed={!showArchived}
          onClick={() => setShowArchived(false)}
        >
          Ativos
        </Button>
        <Button
          size="sm"
          variant={showArchived ? 'secondary' : 'ghost'}
          aria-pressed={showArchived}
          icon="archive"
          onClick={() => setShowArchived(true)}
        >
          Arquivados
        </Button>
      </div>

      {boards.isPending ? (
        <Skeleton height={128} radius={12} />
      ) : boards.isError ? (
        <ErrorState error={boards.error} onRetry={() => boards.refetch()} />
      ) : boards.data.length === 0 ? (
        <EmptyState
          icon={showArchived ? 'archive' : 'board'}
          title={showArchived ? 'Nenhum quadro arquivado' : 'Nenhum quadro ainda'}
          action={
            canCreate && !showArchived ? (
              <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                Criar quadro
              </Button>
            ) : undefined
          }
        />
      ) : (
        <BoardGrid
          boards={boards.data}
          onCreate={canCreate && !showArchived ? () => setCreating(true) : undefined}
        />
      )}
      {ws ? (
        <CreateBoardDialog workspaceId={ws.id} open={creating} onClose={() => setCreating(false)} />
      ) : null}
    </AppShell>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceContent />
    </Suspense>
  );
}
