/**
 * Papéis e regras de permissão do Fluxo.
 * Ficam no pacote compartilhado para que a API aplique as regras
 * e a web esconda/desabilite o que o usuário não pode fazer.
 */
export const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'OBSERVER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
  OBSERVER: 'Observador',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Controle total, inclusive excluir o workspace e definir administradores.',
  ADMIN: 'Gerencia membros, quadros e configurações do workspace.',
  MEMBER: 'Cria e edita quadros, colunas, cartões e comentários.',
  OBSERVER: 'Apenas visualiza os quadros, sem editar.',
};

/** Hierarquia: quanto maior, mais poder. */
export const ROLE_RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1, OBSERVER: 0 };

const EDITORS: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER'];
const MANAGERS: readonly Role[] = ['OWNER', 'ADMIN'];

export const PERMISSIONS = {
  'workspace:view': ROLES,
  'workspace:update': MANAGERS,
  'workspace:delete': ['OWNER'],
  'member:manage': MANAGERS,
  'board:create': EDITORS,
  'board:update': EDITORS,
  'board:delete': MANAGERS,
  'column:manage': EDITORS,
  'card:write': EDITORS,
  'label:manage': EDITORS,
  'comment:create': EDITORS,
  'comment:moderate': MANAGERS,
  'attachment:upload': EDITORS,
  'attachment:moderate': MANAGERS,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Verifica se um papel pode executar uma ação. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/**
 * Regras para alterar o papel de outro membro:
 * - ninguém altera o próprio papel por aqui;
 * - o dono não pode ser rebaixado (só por transferência de propriedade);
 * - apenas o dono promove/rebaixa administradores ou transfere a propriedade;
 * - administradores só gerenciam membros e observadores.
 */
export function canChangeRole(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
  newRole: Role,
): boolean {
  if (actor.id === target.id) return false;
  if (!can(actor.role, 'member:manage')) return false;
  if (target.role === 'OWNER') return false;
  if (actor.role === 'OWNER') return true;
  // Administrador
  return target.role !== 'ADMIN' && newRole !== 'ADMIN' && newRole !== 'OWNER';
}

/** Regras para remover um membro (sair do workspace é tratado à parte). */
export function canRemoveMember(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
): boolean {
  if (target.role === 'OWNER') return false;
  if (actor.id === target.id) return true;
  if (!can(actor.role, 'member:manage')) return false;
  return actor.role === 'OWNER' || ROLE_RANK[target.role] < ROLE_RANK.ADMIN;
}
