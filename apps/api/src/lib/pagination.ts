import type { PageMeta, Paginated, PaginationQuery } from '@fluxo/shared';

export function pageArgs({ page, pageSize }: PaginationQuery) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginate<T>(
  data: T[],
  total: number,
  { page, pageSize }: PaginationQuery,
): Paginated<T> {
  const meta: PageMeta = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
  return { data, meta };
}
