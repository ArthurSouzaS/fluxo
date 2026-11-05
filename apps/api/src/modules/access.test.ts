import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../test/prisma-mock';

const prisma = createPrismaMock();
vi.mock('../lib/prisma', () => ({ prisma }));

const { requireBoard, requireWorkspace, requireCard } = await import('./access');

const boardWith = (role: string | null) => ({
  id: 'b1',
  workspaceId: 'w1',
  title: 'Quadro',
  workspace: { members: role ? [{ role }] : [] },
});

describe('regras de acesso', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requireWorkspace: 404 para quem não é membro', async () => {
    prisma.workspaceMember!.findUnique!.mockResolvedValue(null);
    await expect(requireWorkspace('u1', 'w1')).rejects.toMatchObject({ status: 404 });
  });

  it('requireWorkspace: 403 quando o papel não permite', async () => {
    prisma.workspaceMember!.findUnique!.mockResolvedValue({ role: 'MEMBER' });
    await expect(requireWorkspace('u1', 'w1', 'member:manage')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('requireWorkspace: devolve o papel quando permitido', async () => {
    prisma.workspaceMember!.findUnique!.mockResolvedValue({ role: 'ADMIN' });
    await expect(requireWorkspace('u1', 'w1', 'member:manage')).resolves.toBe('ADMIN');
  });

  it('requireBoard: 404 se o quadro não existe ou o usuário não é membro', async () => {
    prisma.board!.findUnique!.mockResolvedValueOnce(null);
    await expect(requireBoard('u1', 'b1')).rejects.toMatchObject({ status: 404 });
    prisma.board!.findUnique!.mockResolvedValueOnce(boardWith(null));
    await expect(requireBoard('u1', 'b1')).rejects.toMatchObject({ status: 404 });
  });

  it('requireBoard: observador lê mas não escreve', async () => {
    prisma.board!.findUnique!.mockResolvedValue(boardWith('OBSERVER'));
    await expect(requireBoard('u1', 'b1')).resolves.toMatchObject({
      role: 'OBSERVER',
      board: { id: 'b1' },
    });
    await expect(requireBoard('u1', 'b1', 'card:write')).rejects.toMatchObject({ status: 403 });
  });

  it('requireCard: 404 para cartão inexistente', async () => {
    prisma.card!.findUnique!.mockResolvedValue(null);
    await expect(requireCard('u1', 'c1')).rejects.toMatchObject({
      status: 404,
      message: 'Cartão não encontrado',
    });
  });

  it('requireCard: herda a permissão do quadro', async () => {
    prisma.card!.findUnique!.mockResolvedValue({
      id: 'c1',
      boardId: 'b1',
      columnId: 'col',
      title: 'X',
      archived: false,
    });
    prisma.board!.findUnique!.mockResolvedValue(boardWith('MEMBER'));
    await expect(requireCard('u1', 'c1', 'card:write')).resolves.toMatchObject({
      card: { id: 'c1' },
      role: 'MEMBER',
    });
  });
});
