/** Chaves do TanStack Query, centralizadas para invalidações consistentes. */
export const queryKeys = {
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  members: (workspaceId: string) => ['members', workspaceId] as const,
  boards: (workspaceId: string, archived = false) => ['boards', workspaceId, archived] as const,
  board: (id: string) => ['board', id] as const,
  boardStats: (id: string) => ['board-stats', id] as const,
  boardActivities: (id: string) => ['board-activities', id] as const,
  card: (id: string) => ['card', id] as const,
  cardComments: (id: string) => ['card-comments', id] as const,
  cardActivities: (id: string) => ['card-activities', id] as const,
  notifications: ['notifications'] as const,
  search: (q: string) => ['search', q] as const,
};
