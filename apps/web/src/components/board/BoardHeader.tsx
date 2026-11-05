'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { can, ROLE_LABELS, type BoardDetail, type UserPublic } from '@fluxo/shared';
import { boardsApi } from '@/lib/api/endpoints';
import { useBoardMutations } from '@/lib/useBoardMutations';
import { AvatarGroup } from '../ui/Avatar';
import { Button, buttonClassName, IconButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { errorMessage } from '../ui/States';
import { useToast } from '../ui/Toast';
import { ActivityDialog } from './ActivityDialog';
import { BoardSettingsDialog } from './BoardSettingsDialog';
import { LabelsDialog } from './LabelsDialog';
import styles from './BoardHeader.module.scss';

interface BoardHeaderProps {
  board: BoardDetail;
  online: UserPublic[];
  filtersOpen: boolean;
  activeFilterCount: number;
  onToggleFilters: () => void;
}

export function BoardHeader({
  board,
  online,
  filtersOpen,
  activeFilterCount,
  onToggleFilters,
}: BoardHeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { updateBoard } = useBoardMutations(board.id);
  const [dialog, setDialog] = useState<'settings' | 'labels' | 'activity' | 'delete' | null>(null);

  const remove = useMutation({
    mutationFn: () => boardsApi.remove(board.id),
    onSuccess: () => {
      toast.success('Quadro excluído');
      void queryClient.invalidateQueries({ queryKey: ['boards', board.workspaceId] });
      router.replace(`/workspace?id=${board.workspaceId}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const canUpdate = can(board.myRole, 'board:update');
  const readOnly = !can(board.myRole, 'card:write');

  return (
    <header className={styles.header} style={{ ['--board' as string]: board.color }}>
      <div className={styles.titleBlock}>
        <span className={styles.swatch} aria-hidden />
        <div className={styles.titles}>
          <h1 className={styles.title}>{board.title}</h1>
          <p className={styles.subtitle}>
            <Link href={`/workspace?id=${board.workspaceId}`}>{board.workspaceName}</Link>
            {readOnly ? (
              <span className={styles.readOnly}>
                <Icon name="eye" size={12} /> {ROLE_LABELS[board.myRole]} · somente leitura
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        {online.length ? (
          <span
            className={styles.online}
            aria-label={`Online agora: ${online.map((u) => u.name).join(', ')}`}
            role="img"
          >
            <span className={styles.pulse} aria-hidden />
            <AvatarGroup users={online} max={5} size={26} />
          </span>
        ) : null}
        <Button
          size="sm"
          variant={filtersOpen || activeFilterCount ? 'secondary' : 'ghost'}
          icon="filter"
          aria-expanded={filtersOpen}
          onClick={onToggleFilters}
        >
          Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </Button>
        <Link href={`/board/dashboard?id=${board.id}`} className={buttonClassName('ghost', 'sm')}>
          <Icon name="chart" size={14} />
          Dashboard
        </Link>
        <Menu
          items={[
            {
              label: 'Histórico de atividades',
              icon: 'activity',
              onSelect: () => setDialog('activity'),
            },
            {
              label: 'Editar quadro',
              icon: 'edit',
              onSelect: () => setDialog('settings'),
              disabled: !canUpdate,
            },
            {
              label: 'Gerenciar etiquetas',
              icon: 'tag',
              onSelect: () => setDialog('labels'),
              disabled: !can(board.myRole, 'label:manage'),
            },
            {
              label: board.archived ? 'Restaurar quadro' : 'Arquivar quadro',
              icon: 'archive',
              disabled: !canUpdate,
              onSelect: () =>
                updateBoard.mutate(
                  { archived: !board.archived },
                  {
                    onSuccess: () =>
                      toast.success(board.archived ? 'Quadro restaurado' : 'Quadro arquivado'),
                  },
                ),
            },
            {
              label: 'Excluir quadro',
              icon: 'trash',
              danger: true,
              disabled: !can(board.myRole, 'board:delete'),
              onSelect: () => setDialog('delete'),
            },
          ]}
          trigger={(props) => <IconButton icon="more" label="Mais ações do quadro" {...props} />}
        />
      </div>

      {board.archived ? (
        <p className={styles.archived} role="status">
          <Icon name="archive" size={14} /> Este quadro está arquivado.
        </p>
      ) : null}

      <BoardSettingsDialog
        board={board}
        open={dialog === 'settings'}
        onClose={() => setDialog(null)}
      />
      <LabelsDialog board={board} open={dialog === 'labels'} onClose={() => setDialog(null)} />
      <ActivityDialog
        boardId={board.id}
        members={board.members}
        open={dialog === 'activity'}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Excluir quadro?"
        description={`"${board.title}" e todos os cartões, comentários e anexos serão excluídos permanentemente.`}
        confirmLabel="Excluir quadro"
        loading={remove.isPending}
        onClose={() => setDialog(null)}
        onConfirm={() => remove.mutate()}
      />
    </header>
  );
}
