import request from 'supertest';
import type { AuthResponse, BoardDetail, Role } from '@fluxo/shared';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp({ rateLimit: false });
export const api = () => request(app);

export async function resetDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
  if (list) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

let counter = 0;

export interface TestUser {
  id: string;
  name: string;
  email: string;
  username: string;
  token: string;
  /** Cabeçalho pronto para o supertest. */
  auth: { Authorization: string };
  /** Cookie de refresh devolvido no cadastro. */
  cookie: string;
}

export async function createUser(name = 'Pessoa Teste'): Promise<TestUser> {
  counter += 1;
  const email = `pessoa${counter}-${Date.now()}@teste.com`;
  const res = await api()
    .post('/api/auth/register')
    .send({ name, email, password: 'senhaSegura1' })
    .expect(201);
  const body = res.body as AuthResponse;
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return {
    id: body.user.id,
    name: body.user.name,
    email,
    username: body.user.username,
    token: body.accessToken,
    auth: { Authorization: `Bearer ${body.accessToken}` },
    cookie: cookies.find((c) => c.startsWith('fluxo_refresh='))!.split(';')[0]!,
  };
}

export async function createWorkspace(owner: TestUser, name = 'Equipe Teste') {
  const res = await api().post('/api/workspaces').set(owner.auth).send({ name }).expect(201);
  return res.body.id as string;
}

export async function addMember(owner: TestUser, workspaceId: string, user: TestUser, role: Role) {
  if (role === 'OWNER') throw new Error('Use a transferência de propriedade');
  await api()
    .post(`/api/workspaces/${workspaceId}/members`)
    .set(owner.auth)
    .send({ email: user.email, role })
    .expect(201);
}

export async function createBoard(user: TestUser, workspaceId: string, template = 'kanban') {
  const res = await api()
    .post(`/api/workspaces/${workspaceId}/boards`)
    .set(user.auth)
    .send({ title: 'Quadro Teste', template })
    .expect(201);
  return res.body as BoardDetail;
}

export async function createCard(
  user: TestUser,
  columnId: string,
  body: Record<string, unknown> = {},
) {
  const res = await api()
    .post(`/api/columns/${columnId}/cards`)
    .set(user.auth)
    .send({ title: 'Cartão', ...body })
    .expect(201);
  return res.body as { id: string; columnId: string; position: number };
}

/** Cenário comum: dono + admin + membro + observador + estranho e um quadro kanban. */
export async function scenario() {
  const owner = await createUser('Dona Ana');
  const admin = await createUser('Admin Beto');
  const member = await createUser('Membro Caio');
  const observer = await createUser('Observadora Duda');
  const stranger = await createUser('Estranho Edu');
  const workspaceId = await createWorkspace(owner);
  await addMember(owner, workspaceId, admin, 'ADMIN');
  await addMember(owner, workspaceId, member, 'MEMBER');
  await addMember(owner, workspaceId, observer, 'OBSERVER');
  const board = await createBoard(owner, workspaceId);
  return { owner, admin, member, observer, stranger, workspaceId, board };
}
