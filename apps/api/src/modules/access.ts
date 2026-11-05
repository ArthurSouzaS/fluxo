/**
 * Verificações de acesso. Toda rota que lida com um recurso passa por aqui:
 * 1. o recurso existe?
 * 2. o usuário é membro do workspace dono do recurso? (senão 404, para não
 *    revelar a existência de recursos de outros workspaces)
 * 3. o papel dele permite a ação? (senão 403)
 */
import { can, type Permission, type Role } from '@fluxo/shared';
import { prisma } from '../lib/prisma';
import { forbidden, notFound } from '../lib/errors';

export async function getRole(userId: string, workspaceId: string): Promise<Role | null> {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return (member?.role as Role | undefined) ?? null;
}

function check(role: Role | null, permission: Permission | undefined, entity: string): Role {
  if (!role) throw notFound(`${entity} não encontrado`);
  if (permission && !can(role, permission)) throw forbidden();
  return role;
}

export async function requireWorkspace(
  userId: string,
  workspaceId: string,
  permission?: Permission,
) {
  const role = await getRole(userId, workspaceId);
  return check(role, permission, 'Workspace');
}

export async function requireBoard(userId: string, boardId: string, permission?: Permission) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      workspaceId: true,
      title: true,
      workspace: { select: { members: { where: { userId }, select: { role: true } } } },
    },
  });
  const role = (board?.workspace.members[0]?.role as Role | undefined) ?? null;
  check(role, permission, 'Quadro');
  return {
    board: { id: board!.id, workspaceId: board!.workspaceId, title: board!.title },
    role: role!,
  };
}

export async function requireColumn(userId: string, columnId: string, permission?: Permission) {
  const column = await prisma.boardColumn.findUnique({ where: { id: columnId } });
  if (!column) throw notFound('Coluna não encontrada');
  const access = await requireBoard(userId, column.boardId, permission);
  return { ...access, column };
}

export async function requireCard(userId: string, cardId: string, permission?: Permission) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { id: true, boardId: true, columnId: true, title: true, archived: true },
  });
  if (!card) throw notFound('Cartão não encontrado');
  const access = await requireBoard(userId, card.boardId, permission);
  return { ...access, card };
}

export async function requireLabel(userId: string, labelId: string, permission?: Permission) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) throw notFound('Etiqueta não encontrada');
  const access = await requireBoard(userId, label.boardId, permission);
  return { ...access, label };
}

export async function requireChecklist(
  userId: string,
  checklistId: string,
  permission?: Permission,
) {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { card: { select: { id: true, boardId: true, title: true } } },
  });
  if (!checklist) throw notFound('Checklist não encontrado');
  const access = await requireBoard(userId, checklist.card.boardId, permission);
  return { ...access, checklist };
}

export async function requireChecklistItem(
  userId: string,
  itemId: string,
  permission?: Permission,
) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: {
      checklist: {
        select: { id: true, card: { select: { id: true, boardId: true, title: true } } },
      },
    },
  });
  if (!item) throw notFound('Item não encontrado');
  const access = await requireBoard(userId, item.checklist.card.boardId, permission);
  return { ...access, item };
}

export async function requireComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { card: { select: { id: true, boardId: true, title: true } } },
  });
  if (!comment) throw notFound('Comentário não encontrado');
  const access = await requireBoard(userId, comment.card.boardId);
  return { ...access, comment };
}

export async function requireAttachment(userId: string, attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { card: { select: { id: true, boardId: true, title: true } } },
  });
  if (!attachment) throw notFound('Anexo não encontrado');
  const access = await requireBoard(userId, attachment.card.boardId);
  return { ...access, attachment };
}
