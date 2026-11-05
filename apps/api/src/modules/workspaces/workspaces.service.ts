import {
  canChangeRole,
  canRemoveMember,
  ROLE_LABELS,
  type AddMemberInput,
  type CreateWorkspaceInput,
  type Member,
  type Role,
  type UpdateMemberInput,
  type UpdateWorkspaceInput,
  type WorkspaceSummary,
} from '@fluxo/shared';
import type { Ctx } from '../../lib/context';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { memberInclude, toMember, toNotification, notificationInclude } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { logActivity } from '../activities/activity.logger';
import { requireWorkspace } from '../access';

async function summary(workspaceId: string, role: Role): Promise<WorkspaceSummary> {
  const ws = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: { _count: { select: { members: true, boards: { where: { archived: false } } } } },
  });
  return {
    id: ws.id,
    name: ws.name,
    description: ws.description,
    role,
    memberCount: ws._count.members,
    boardCount: ws._count.boards,
    createdAt: ws.createdAt.toISOString(),
  };
}

export async function list(ctx: Ctx): Promise<WorkspaceSummary[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: ctx.userId },
    orderBy: { joinedAt: 'asc' },
    include: {
      workspace: {
        include: { _count: { select: { members: true, boards: { where: { archived: false } } } } },
      },
    },
  });
  return memberships.map(({ workspace: ws, role }) => ({
    id: ws.id,
    name: ws.name,
    description: ws.description,
    role: role as Role,
    memberCount: ws._count.members,
    boardCount: ws._count.boards,
    createdAt: ws.createdAt.toISOString(),
  }));
}

export async function get(ctx: Ctx, workspaceId: string) {
  const role = await requireWorkspace(ctx.userId, workspaceId);
  return summary(workspaceId, role);
}

export async function create(ctx: Ctx, input: CreateWorkspaceInput) {
  const ws = await prisma.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: {
        name: input.name,
        description: input.description || null,
        members: { create: { userId: ctx.userId, role: 'OWNER' } },
      },
    });
    await logActivity(
      { workspaceId: created.id, actorId: ctx.userId, type: 'workspace.created' },
      tx,
    );
    return created;
  });
  return summary(ws.id, 'OWNER');
}

export async function update(ctx: Ctx, workspaceId: string, input: UpdateWorkspaceInput) {
  const role = await requireWorkspace(ctx.userId, workspaceId, 'workspace:update');
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description || null,
    },
  });
  await logActivity({ workspaceId, actorId: ctx.userId, type: 'workspace.updated' });
  return summary(workspaceId, role);
}

export async function remove(ctx: Ctx, workspaceId: string) {
  await requireWorkspace(ctx.userId, workspaceId, 'workspace:delete');
  const boards = await prisma.board.findMany({ where: { workspaceId }, select: { id: true } });
  const attachments = await prisma.attachment.findMany({
    where: { card: { board: { workspaceId } } },
    select: { storedName: true },
  });
  await prisma.workspace.delete({ where: { id: workspaceId } });
  for (const board of boards) {
    realtimeBus.publishToBoard(ctx, board.id, { type: 'board.deleted', boardId: board.id });
  }
  return attachments.map((attachment) => attachment.storedName);
}

// ---------------------------------------------------------------------------
// Membros
// ---------------------------------------------------------------------------

async function notifyBoards(ctx: Ctx, workspaceId: string) {
  const boards = await prisma.board.findMany({ where: { workspaceId }, select: { id: true } });
  for (const board of boards) {
    realtimeBus.publishToBoard(ctx, board.id, { type: 'members.changed' });
  }
}

export async function listMembers(ctx: Ctx, workspaceId: string): Promise<Member[]> {
  await requireWorkspace(ctx.userId, workspaceId);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: memberInclude,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  return members.map(toMember);
}

export async function addMember(ctx: Ctx, workspaceId: string, input: AddMemberInput) {
  const actorRole = await requireWorkspace(ctx.userId, workspaceId, 'member:manage');
  if (input.role === 'ADMIN' && actorRole !== 'OWNER') {
    throw forbidden('Apenas o dono pode adicionar administradores');
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw notFound('Nenhum usuário cadastrado com este e-mail', 'USER_NOT_FOUND');
  }
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (existing) throw conflict('Esta pessoa já é membro do workspace', 'ALREADY_MEMBER');

  const [member, workspace, actor] = await Promise.all([
    prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: input.role },
      include: memberInclude,
    }),
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { name: true } }),
  ]);

  await logActivity({
    workspaceId,
    actorId: ctx.userId,
    type: 'member.added',
    data: { userName: user.name },
  });
  const notification = await prisma.notification.create({
    data: {
      userId: user.id,
      actorId: ctx.userId,
      type: 'MEMBER_ADDED',
      message: `${actor.name} adicionou você ao workspace "${workspace.name}"`,
      data: { workspaceId },
    },
    include: notificationInclude,
  });
  realtimeBus.publishNotification(user.id, toNotification(notification));
  await notifyBoards(ctx, workspaceId);
  return toMember(member);
}

export async function updateMember(
  ctx: Ctx,
  workspaceId: string,
  targetUserId: string,
  input: UpdateMemberInput,
) {
  const actorRole = await requireWorkspace(ctx.userId, workspaceId, 'member:manage');
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    include: memberInclude,
  });
  if (!target) throw notFound('Membro não encontrado');

  const actor = { id: ctx.userId, role: actorRole };
  const targetInfo = { id: targetUserId, role: target.role as Role };
  if (!canChangeRole(actor, targetInfo, input.role)) {
    throw forbidden('Você não pode alterar o papel deste membro');
  }

  if (input.role === 'OWNER') {
    // Transferência de propriedade: o dono atual vira administrador.
    await prisma.$transaction([
      prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: ctx.userId } },
        data: { role: 'ADMIN' },
      }),
      prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
        data: { role: 'OWNER' },
      }),
    ]);
  } else {
    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role: input.role },
    });
  }

  await logActivity({
    workspaceId,
    actorId: ctx.userId,
    type: 'member.role_changed',
    data: { userName: target.user.name, role: ROLE_LABELS[input.role] },
  });
  await notifyBoards(ctx, workspaceId);
  const updated = await prisma.workspaceMember.findUniqueOrThrow({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    include: memberInclude,
  });
  return toMember(updated);
}

export async function removeMember(ctx: Ctx, workspaceId: string, targetUserId: string) {
  const actorRole = await requireWorkspace(ctx.userId, workspaceId);
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    include: memberInclude,
  });
  if (!target) throw notFound('Membro não encontrado');

  const actor = { id: ctx.userId, role: actorRole };
  const targetInfo = { id: targetUserId, role: target.role as Role };
  if (!canRemoveMember(actor, targetInfo)) {
    if (target.role === 'OWNER') {
      throw badRequest(
        'O dono não pode sair do workspace. Transfira a propriedade antes.',
        'OWNER_CANNOT_LEAVE',
      );
    }
    throw forbidden('Você não pode remover este membro');
  }

  await prisma.$transaction([
    // Remove as atribuições da pessoa nos cartões do workspace.
    prisma.cardAssignee.deleteMany({
      where: { userId: targetUserId, card: { board: { workspaceId } } },
    }),
    prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    }),
  ]);
  await logActivity({
    workspaceId,
    actorId: ctx.userId,
    type: 'member.removed',
    data: { userName: target.user.name },
  });
  await notifyBoards(ctx, workspaceId);
}
