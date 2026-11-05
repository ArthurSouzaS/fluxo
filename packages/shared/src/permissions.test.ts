import { describe, expect, it } from 'vitest';
import { can, canChangeRole, canRemoveMember, ROLES, type Role } from './permissions';

const user = (id: string, role: Role) => ({ id, role });

describe('can', () => {
  it('todos os papéis podem visualizar o workspace', () => {
    for (const role of ROLES) expect(can(role, 'workspace:view')).toBe(true);
  });

  it('observador não pode editar nada', () => {
    expect(can('OBSERVER', 'card:write')).toBe(false);
    expect(can('OBSERVER', 'comment:create')).toBe(false);
    expect(can('OBSERVER', 'board:create')).toBe(false);
  });

  it('membro edita cartões mas não gerencia membros nem exclui quadros', () => {
    expect(can('MEMBER', 'card:write')).toBe(true);
    expect(can('MEMBER', 'member:manage')).toBe(false);
    expect(can('MEMBER', 'board:delete')).toBe(false);
  });

  it('somente o dono exclui o workspace', () => {
    expect(can('OWNER', 'workspace:delete')).toBe(true);
    expect(can('ADMIN', 'workspace:delete')).toBe(false);
  });

  it('sem papel não tem permissão', () => {
    expect(can(null, 'workspace:view')).toBe(false);
    expect(can(undefined, 'workspace:view')).toBe(false);
  });
});

describe('canChangeRole', () => {
  it('dono promove membro a administrador', () => {
    expect(canChangeRole(user('a', 'OWNER'), user('b', 'MEMBER'), 'ADMIN')).toBe(true);
  });

  it('administrador não promove ninguém a administrador', () => {
    expect(canChangeRole(user('a', 'ADMIN'), user('b', 'MEMBER'), 'ADMIN')).toBe(false);
  });

  it('administrador altera membro para observador', () => {
    expect(canChangeRole(user('a', 'ADMIN'), user('b', 'MEMBER'), 'OBSERVER')).toBe(true);
  });

  it('administrador não altera outro administrador', () => {
    expect(canChangeRole(user('a', 'ADMIN'), user('b', 'ADMIN'), 'MEMBER')).toBe(false);
  });

  it('ninguém altera o papel do dono nem o próprio papel', () => {
    expect(canChangeRole(user('a', 'ADMIN'), user('b', 'OWNER'), 'MEMBER')).toBe(false);
    expect(canChangeRole(user('a', 'OWNER'), user('a', 'OWNER'), 'MEMBER')).toBe(false);
  });

  it('membro não altera papéis', () => {
    expect(canChangeRole(user('a', 'MEMBER'), user('b', 'OBSERVER'), 'MEMBER')).toBe(false);
  });
});

describe('canRemoveMember', () => {
  it('qualquer um pode sair, exceto o dono', () => {
    expect(canRemoveMember(user('a', 'MEMBER'), user('a', 'MEMBER'))).toBe(true);
    expect(canRemoveMember(user('a', 'OWNER'), user('a', 'OWNER'))).toBe(false);
  });

  it('administrador remove membros, mas não outros administradores', () => {
    expect(canRemoveMember(user('a', 'ADMIN'), user('b', 'MEMBER'))).toBe(true);
    expect(canRemoveMember(user('a', 'ADMIN'), user('b', 'ADMIN'))).toBe(false);
  });

  it('dono remove administradores', () => {
    expect(canRemoveMember(user('a', 'OWNER'), user('b', 'ADMIN'))).toBe(true);
  });

  it('membro não remove outros', () => {
    expect(canRemoveMember(user('a', 'MEMBER'), user('b', 'OBSERVER'))).toBe(false);
  });
});
