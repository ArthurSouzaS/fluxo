'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { can, ROLE_LABELS, type WorkspaceSummary } from '@fluxo/shared';
import { boardsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { EmptyState, ErrorState, Skeleton } from '../ui/States';
import { BoardGrid } from './BoardGrid';
import { CreateBoardDialog } from './CreateBoardDialog';
import styles from './WorkspaceSection.module.scss';

export function WorkspaceSection({ workspace }: { workspace: WorkspaceSummary }) {
  const [creating, setCreating] = useState(false);
  const boards = useQuery({
    queryKey: queryKeys.boards(workspace.id),
    queryFn: () => boardsApi.list(workspace.id),
  });
  const canCreate = can(workspace.role, 'board:create');

  return (
    <section className={styles.section} aria-labelledby={`ws-${workspace.id}`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.avatar} aria-hidden>
            {workspace.name[0]?.toUpperCase()}
          </span>
          <div>
            <h2 id={`ws-${workspace.id}`} className={styles.title}>
              <Link href={`/workspace?id=${workspace.id}`}>{workspace.name}</Link>
            </h2>
            <p className={styles.meta}>
              {ROLE_LABELS[workspace.role]} · {workspace.memberCount}{' '}
              {workspace.memberCount === 1 ? 'membro' : 'membros'}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <Link href={`/workspace/settings?id=${workspace.id}`} className={styles.link}>
            <Icon name="users" size={14} /> Membros
          </Link>
        </div>
      </header>
      {boards.isPending ? (
        <div className={styles.skeletons}>
          <Skeleton height={128} radius={12} />
          <Skeleton height={128} radius={12} />
          <Skeleton height={128} radius={12} />
        </div>
      ) : boards.isError ? (
        <ErrorState error={boards.error} onRetry={() => boards.refetch()} />
      ) : boards.data.length === 0 && !canCreate ? (
        <EmptyState compact icon="board" title="Nenhum quadro ainda" />
      ) : boards.data.length === 0 ? (
        <EmptyState
          compact
          icon="board"
          title="Nenhum quadro ainda"
          description="Crie o primeiro quadro para organizar as tarefas da equipe."
          action={
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Criar quadro
            </Button>
          }
        />
      ) : (
        <BoardGrid
          boards={boards.data}
          onCreate={canCreate ? () => setCreating(true) : undefined}
        />
      )}
      <CreateBoardDialog
        workspaceId={workspace.id}
        open={creating}
        onClose={() => setCreating(false)}
      />
    </section>
  );
}
