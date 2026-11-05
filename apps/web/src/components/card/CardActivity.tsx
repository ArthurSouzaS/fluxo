'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { cardsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { Button } from '../ui/Button';
import { ErrorState, Skeleton } from '../ui/States';
import { ActivityList } from './ActivityList';

export function CardActivity({ cardId }: { cardId: string }) {
  const activities = useInfiniteQuery({
    queryKey: queryKeys.cardActivities(cardId),
    queryFn: ({ pageParam }) => cardsApi.activities(cardId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
  if (activities.isPending) return <Skeleton height={80} />;
  if (activities.isError)
    return <ErrorState error={activities.error} onRetry={() => activities.refetch()} />;
  return (
    <>
      <ActivityList activities={activities.data.pages.flatMap((page) => page.data)} />
      {activities.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          block
          onClick={() => activities.fetchNextPage()}
          loading={activities.isFetchingNextPage}
        >
          Carregar mais
        </Button>
      ) : null}
    </>
  );
}
