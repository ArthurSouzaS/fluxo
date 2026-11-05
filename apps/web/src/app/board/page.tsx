'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { can } from '@fluxo/shared';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { BoardHeader } from '@/components/board/BoardHeader';
import { BoardSkeleton } from '@/components/board/BoardSkeleton';
import { FilterBar } from '@/components/board/FilterBar';
import { CardModal } from '@/components/card/CardModal';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { boardsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { useAuth } from '@/lib/auth/AuthProvider';
import { emptyFilters, filterCards, sortedColumns, type BoardFilters } from '@/lib/board-state';
import { useHotkeys } from '@/lib/hooks/useHotkeys';
import { useBoardRealtime } from '@/lib/realtime/useBoardRealtime';

function BoardContent() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const boardId = params.get('id') ?? '';
  const cardId = params.get('card');

  const [filters, setFilters] = useState<BoardFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [composerColumnId, setComposerColumnId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const board = useQuery({
    queryKey: queryKeys.board(boardId),
    queryFn: () => boardsApi.get(boardId),
    enabled: !!boardId,
  });

  const onDeleted = useCallback(() => {
    toast.info('Este quadro foi excluído por outra pessoa.');
    router.replace('/app');
  }, [router, toast]);
  const online = useBoardRealtime(boardId || null, onDeleted);

  const openCard = useCallback(
    (id: string) => router.push(`/board?id=${boardId}&card=${id}`, { scroll: false }),
    [router, boardId],
  );
  const closeCard = useCallback(
    () => router.push(`/board?id=${boardId}`, { scroll: false }),
    [router, boardId],
  );

  const activeFilterCount =
    (filters.q.trim() ? 1 : 0) +
    filters.labelIds.length +
    filters.assigneeIds.length +
    (filters.due ? 1 : 0);
  const resultCount = useMemo(
    () => (board.data ? filterCards(board.data.cards, filters).length : 0),
    [board.data, filters],
  );

  useHotkeys(
    [
      {
        combo: 'n',
        handler: (event) => {
          if (!board.data || !can(board.data.myRole, 'card:write')) return;
          const first = sortedColumns(board.data)[0];
          if (first) {
            event.preventDefault();
            setComposerColumnId(first.id);
          }
        },
      },
      {
        combo: 'f',
        handler: (event) => {
          event.preventDefault();
          setFiltersOpen(true);
          requestAnimationFrame(() => searchRef.current?.focus());
        },
      },
      { combo: 'd', handler: () => router.push(`/board/dashboard?id=${boardId}`) },
    ],
    !cardId,
  );

  const crumbs = [
    { label: 'Workspaces', href: '/app' },
    ...(board.data
      ? [{ label: board.data.workspaceName, href: `/workspace?id=${board.data.workspaceId}` }]
      : []),
    { label: board.data?.title ?? 'Quadro' },
  ];

  return (
    <AppShell crumbs={crumbs} wide>
      {board.isPending ? (
        <BoardSkeleton />
      ) : board.isError ? (
        <div style={{ padding: 24 }}>
          <ErrorState error={board.error} onRetry={() => board.refetch()} />
        </div>
      ) : (
        <>
          <BoardHeader
            board={board.data}
            online={online}
            filtersOpen={filtersOpen}
            activeFilterCount={activeFilterCount}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
          />
          {filtersOpen || activeFilterCount ? (
            <FilterBar
              ref={searchRef}
              filters={filters}
              onChange={setFilters}
              labels={board.data.labels}
              members={board.data.members}
              currentUserId={user?.id ?? ''}
              resultCount={resultCount}
            />
          ) : null}
          <BoardCanvas
            board={board.data}
            filters={filters}
            composerColumnId={composerColumnId}
            onComposerChange={setComposerColumnId}
            onOpenCard={openCard}
          />
          {cardId ? <CardModal cardId={cardId} board={board.data} onClose={closeCard} /> : null}
        </>
      )}
    </AppShell>
  );
}

export default function BoardPage() {
  return (
    <Suspense>
      <BoardContent />
    </Suspense>
  );
}
