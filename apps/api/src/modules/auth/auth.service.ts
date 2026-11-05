import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
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

const AVATAR_COLORS = ['#34d399', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#fb7185', '#2dd4bf'];

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
): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
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
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
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
export async function refresh(refreshToken: string | undefined): Promise<AuthResult> {
  if (!refreshToken) throw unauthorized('Sessão expirada', 'REFRESH_MISSING');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
  });
  if (!stored) throw unauthorized('Sessão inválida', 'REFRESH_INVALID');

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: stored.family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Sessão inválida', 'REFRESH_REUSED');
  }
  if (stored.expiresAt <= new Date()) throw unauthorized('Sessão expirada', 'REFRESH_EXPIRED');

  // Revoga de forma condicional para evitar corrida entre duas requisições simultâneas.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw unauthorized('Sessão inválida', 'REFRESH_REUSED');

  const user = await prisma.user.findUnique({
    where: { id: stored.userId },
    select: userProfileSelect,
  });
  if (!user) throw unauthorized('Sessão inválida', 'REFRESH_INVALID');

  const tokens = await issueTokens(user.id, stored.family);
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
