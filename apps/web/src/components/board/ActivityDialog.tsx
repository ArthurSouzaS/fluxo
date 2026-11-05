'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Member } from '@fluxo/shared';
import { boardsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { ActivityList } from '../card/ActivityList';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ErrorState, Skeleton } from '../ui/States';

export function ActivityDialog({
  boardId,
  open,
  onClose,
}: {
  boardId: string;
  members: Member[];
  open: boolean;
  onClose: () => void;
}) {
  const activities = useInfiniteQuery({
    queryKey: queryKeys.boardActivities(boardId),
    queryFn: ({ pageParam }) => boardsApi.activities(boardId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: open,
  });

  return (
    <Modal open={open} onClose={onClose} title="Histórico do quadro" size="md">
      {activities.isPending ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : activities.isError ? (
        <ErrorState error={activities.error} onRetry={() => activities.refetch()} />
      ) : (
        <>
          <ActivityList activities={activities.data.pages.flatMap((page) => page.data)} showCard />
          {activities.hasNextPage ? (
            <Button
              block
              variant="ghost"
              onClick={() => activities.fetchNextPage()}
              loading={activities.isFetchingNextPage}
            >
              Carregar mais
            </Button>
          ) : null}
        </>
      )}
    </Modal>
  );
}
