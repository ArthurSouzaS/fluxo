import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  AVATAR_COLORS,
  randomItem,
  slugifyUsername,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type UserProfile,
} from '@fluxo/shared';
import { env } from '../../config/env';
import { conflict, notFound, unauthorized } from '../../lib/errors';
import { toUserProfile, userProfileSelect } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from '../../lib/tokens';

/** Janela em que reapresentar um token recém-rotacionado não é tratado como roubo. */
const REUSE_GRACE_MS = 10_000;

/** Hash usado quando o e-mail não existe, para o tempo de resposta não denunciar isso. */
const DUMMY_HASH = bcrypt.hashSync('senha-que-nao-existe', 4);

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: UserProfile;
}

/** Gera um apelido único a partir do nome (ana.silva, ana.silva2, ...). */
export async function generateUniqueUsername(source: string): Promise<string> {
  const base = slugifyUsername(source).slice(0, 20);
  const taken = await prisma.user.findMany({
    where: { username: { startsWith: base } },
    select: { username: true },
  });
  const names = new Set(taken.map((user) => user.username));
  if (!names.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!names.has(candidate)) return candidate;
  }
}

async function issueTokens(
  userId: string,
  family: string = crypto.randomUUID(),
  tx: Prisma.TransactionClient = prisma,
): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  await tx.refreshToken.create({
    data: {
      userId,
      family,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });
  return { accessToken: signAccessToken(userId), refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('Este e-mail já está cadastrado', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);
  const username = await generateUniqueUsername(input.name);
  const firstName = input.name.split(' ')[0];

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        username,
        passwordHash,
        avatarColor: randomItem(AVATAR_COLORS),
      },
      select: userProfileSelect,
    });
    // Todo usuário começa com um workspace pessoal.
    await tx.workspace.create({
      data: {
        name: `Espaço de ${firstName}`,
        description: 'Seu workspace pessoal. Convide pessoas quando quiser colaborar.',
        members: { create: { userId: created.id, role: 'OWNER' } },
      },
    });
    return created;
  });

  const tokens = await issueTokens(user.id);
  return { user: toUserProfile(user), ...tokens };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...userProfileSelect, passwordHash: true },
  });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw unauthorized('E-mail ou senha incorretos', 'INVALID_CREDENTIALS');

  const tokens = await issueTokens(user.id);
  return { user: toUserProfile(user), ...tokens };
}

/**
 * Troca um refresh token válido por um novo par (rotação).
 * Se um token já revogado for reutilizado, toda a família é revogada:
 * é o sinal clássico de token roubado.
 */
export async function refresh(refreshToken: string | undefined, attempt = 0): Promise<AuthResult> {
  if (!refreshToken) throw unauthorized('Sessão expirada', 'REFRESH_MISSING');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
  });
  if (!stored) throw unauthorized('Sessão inválida', 'REFRESH_INVALID');

  if (stored.revokedAt) {
    // Duas abas (ou duas requisições) renovando ao mesmo tempo com o mesmo token
    // não indicam roubo: dentro da janela de tolerância, apenas emite um novo par.
    const elapsed = Date.now() - stored.revokedAt.getTime();
    const familyAlive =
      stored.rotatedAt !== null &&
      (await prisma.refreshToken.count({ where: { family: stored.family, revokedAt: null } })) > 0;
    if (familyAlive && elapsed <= REUSE_GRACE_MS && stored.expiresAt > new Date()) {
      const user = await prisma.user.findUnique({
        where: { id: stored.userId },
        select: userProfileSelect,
      });
      if (!user) throw unauthorized('Sessão inválida', 'REFRESH_INVALID');
      return { user: toUserProfile(user), ...(await issueTokens(user.id, stored.family)) };
    }
    await prisma.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Sessão inválida', 'REFRESH_REUSED');
  }
  if (stored.expiresAt <= new Date()) throw unauthorized('Sessão expirada', 'REFRESH_EXPIRED');

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    select: userProfileSelect,
  });
  if (!user) throw unauthorized('Sessão inválida', 'REFRESH_INVALID');

  // Revoga e emite o novo token na mesma transação: uma requisição concorrente
  // com o mesmo token espera o commit e cai na janela de tolerância acima.
  const now = new Date();
  const tokens = await prisma.$transaction(async (tx) => {
    const { count } = await tx.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now, rotatedAt: now },
    });
    return count === 0 ? null : issueTokens(user.id, stored.family, tx);
  });
  if (!tokens) {
    if (attempt > 0) throw unauthorized('Sessão inválida', 'REFRESH_REUSED');
    return refresh(refreshToken, attempt + 1);
  }
  return { user: toUserProfile(user), ...tokens };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    select: { family: true },
  });
  if (!stored) return;
  await prisma.refreshToken.updateMany({
    where: { family: stored.family, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Troca a senha, encerra todas as sessões e devolve um novo par de tokens. */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...userProfileSelect, passwordHash: true },
  });
  if (!user) throw notFound('Usuário não encontrado');

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw unauthorized('Senha atual incorreta', 'INVALID_PASSWORD');

  const passwordHash = await bcrypt.hash(input.newPassword, env.bcryptRounds);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const tokens = await issueTokens(userId);
  return { user: toUserProfile(user), ...tokens };
}
