export const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'OBSERVER'] as const;
export type Role = (typeof ROLES)[number];
