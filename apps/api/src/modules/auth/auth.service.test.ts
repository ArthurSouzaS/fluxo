import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaMock } from '../../test/prisma-mock';

const prisma = createPrismaMock();
vi.mock('../../lib/prisma', () => ({ prisma }));

const service = await import('./auth.service');
const { hashRefreshToken, verifyAccessToken } = await import('../../lib/tokens');

const user = {
  id: 'u1',
  name: 'Ana Souza',
  username: 'ana.souza',
  email: 'ana@teste.com',
  avatarColor: '#34d399',
  createdAt: new Date('2026-01-01'),
};

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.refreshToken!.create!.mockResolvedValue({});
  });

  it('generateUniqueUsername adiciona sufixo quando o apelido existe', async () => {
    prisma.user!.findMany!.mockResolvedValue([
      { username: 'ana.souza' },
      { username: 'ana.souza2' },
    ]);
    await expect(service.generateUniqueUsername('Ana Souza')).resolves.toBe('ana.souza3');
  });

  it('register recusa e-mail existente', async () => {
    prisma.user!.findUnique!.mockResolvedValue(user);
    await expect(
      service.register({ name: 'Ana', email: user.email, password: 'senhaSegura1' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('register cria usuário com senha em hash e workspace pessoal', async () => {
    prisma.user!.findUnique!.mockResolvedValue(null);
    prisma.user!.findMany!.mockResolvedValue([]);
    prisma.user!.create!.mockResolvedValue(user);
    prisma.workspace!.create!.mockResolvedValue({});

    const result = await service.register({
      name: 'Ana Souza',
      email: user.email,
      password: 'senhaSegura1',
    });

    const data = prisma.user!.create!.mock.calls[0]![0].data;
    expect(data.passwordHash).not.toBe('senhaSegura1');
    expect(await bcrypt.compare('senhaSegura1', data.passwordHash)).toBe(true);
    expect(prisma.workspace!.create!.mock.calls[0]![0].data.name).toBe('Espaço de Ana');
    expect(verifyAccessToken(result.accessToken)).toBe('u1');
    // O refresh token salvo é o hash, nunca o valor puro.
    const saved = prisma.refreshToken!.create!.mock.calls[0]![0].data;
    expect(saved.tokenHash).toBe(hashRefreshToken(result.refreshToken));
  });

  it('login recusa senha errada com o mesmo erro de usuário inexistente', async () => {
    prisma.user!.findUnique!.mockResolvedValueOnce({
      ...user,
      passwordHash: await bcrypt.hash('certa123', 4),
    });
    await expect(service.login({ email: user.email, password: 'errada123' })).rejects.toMatchObject(
      {
        status: 401,
        code: 'INVALID_CREDENTIALS',
      },
    );
    prisma.user!.findUnique!.mockResolvedValueOnce(null);
    await expect(service.login({ email: 'x@y.com', password: 'errada123' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('refresh revoga a família inteira quando um token antigo é reutilizado', async () => {
    prisma.refreshToken!.findUnique!.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      family: 'f1',
      revokedAt: new Date(Date.now() - 60_000),
      rotatedAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.refreshToken!.count!.mockResolvedValue(1);
    prisma.refreshToken!.updateMany!.mockResolvedValue({ count: 1 });

    await expect(service.refresh('token-antigo')).rejects.toMatchObject({ code: 'REFRESH_REUSED' });
    expect(prisma.refreshToken!.updateMany!).toHaveBeenCalledWith({
      where: { family: 'f1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('refresh recusa token expirado', async () => {
    prisma.refreshToken!.findUnique!.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      family: 'f1',
      revokedAt: null,
      rotatedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.refresh('token')).rejects.toMatchObject({ code: 'REFRESH_EXPIRED' });
  });

  it('refresh rotaciona o token válido', async () => {
    prisma.refreshToken!.findUnique!.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      family: 'f1',
      revokedAt: null,
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user!.findUnique!.mockResolvedValue(user);
    prisma.refreshToken!.updateMany!.mockResolvedValue({ count: 1 });

    const result = await service.refresh('token');
    expect(result.user.id).toBe('u1');
    expect(prisma.refreshToken!.create!.mock.calls[0]![0].data.family).toBe('f1');
  });

  it('changePassword exige a senha atual correta', async () => {
    prisma.user!.findUnique!.mockResolvedValue({
      ...user,
      passwordHash: await bcrypt.hash('atual123', 4),
    });
    await expect(
      service.changePassword('u1', { currentPassword: 'errada123', newPassword: 'novaSenha1' }),
    ).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
  });
});
