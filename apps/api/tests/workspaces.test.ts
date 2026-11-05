import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { addMember, api, createUser, createWorkspace, scenario } from './helpers';

describe('Workspaces', () => {
  it('cria workspace com o criador como dono e registra atividade', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/workspaces')
      .set(user.auth)
      .send({ name: 'Turma 2026', description: 'Projetos da turma' })
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Turma 2026',
      role: 'OWNER',
      memberCount: 1,
      boardCount: 0,
    });
    const activities = await prisma.activity.count({ where: { workspaceId: res.body.id } });
    expect(activities).toBe(1);
  });

  it('valida o nome (400)', async () => {
    const user = await createUser();
    await api().post('/api/workspaces').set(user.auth).send({ name: 'x' }).expect(400);
  });

  it('lista apenas os workspaces do usuário', async () => {
    const { owner, stranger } = await scenario();
    const ownerList = await api().get('/api/workspaces').set(owner.auth).expect(200);
    const strangerList = await api().get('/api/workspaces').set(stranger.auth).expect(200);
    expect(ownerList.body).toHaveLength(2); // pessoal + equipe
    expect(strangerList.body).toHaveLength(1); // só o pessoal
  });

  it('detalha um workspace para membros e esconde de estranhos (404)', async () => {
    const { workspaceId, observer, stranger } = await scenario();
    const res = await api().get(`/api/workspaces/${workspaceId}`).set(observer.auth).expect(200);
    expect(res.body).toMatchObject({ role: 'OBSERVER', memberCount: 4, boardCount: 1 });
    await api().get(`/api/workspaces/${workspaceId}`).set(stranger.auth).expect(404);
  });

  it('dono e admin editam; membro recebe 403', async () => {
    const { workspaceId, admin, member } = await scenario();
    await api()
      .patch(`/api/workspaces/${workspaceId}`)
      .set(admin.auth)
      .send({ name: 'Novo nome' })
      .expect(200);
    await api()
      .patch(`/api/workspaces/${workspaceId}`)
      .set(member.auth)
      .send({ name: 'Outro' })
      .expect(403);
  });

  it('somente o dono exclui o workspace', async () => {
    const { workspaceId, owner, admin } = await scenario();
    await api().delete(`/api/workspaces/${workspaceId}`).set(admin.auth).expect(403);
    await api().delete(`/api/workspaces/${workspaceId}`).set(owner.auth).expect(204);
    await api().get(`/api/workspaces/${workspaceId}`).set(owner.auth).expect(404);
  });
});

describe('Membros', () => {
  it('lista membros ordenados por papel', async () => {
    const { workspaceId, member } = await scenario();
    const res = await api()
      .get(`/api/workspaces/${workspaceId}/members`)
      .set(member.auth)
      .expect(200);
    expect(res.body.map((m: { role: string }) => m.role)).toEqual([
      'OWNER',
      'ADMIN',
      'MEMBER',
      'OBSERVER',
    ]);
    expect(res.body[0].user.passwordHash).toBeUndefined();
  });

  it('adiciona membro por e-mail e notifica a pessoa', async () => {
    const owner = await createUser();
    const guest = await createUser();
    const workspaceId = await createWorkspace(owner);
    const res = await api()
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(owner.auth)
      .send({ email: guest.email.toUpperCase() })
      .expect(201);
    expect(res.body).toMatchObject({ userId: guest.id, role: 'MEMBER' });

    const notifications = await api().get('/api/notifications').set(guest.auth).expect(200);
    expect(notifications.body.data[0]).toMatchObject({ type: 'MEMBER_ADDED' });
  });

  it('responde 404 para e-mail não cadastrado e 409 para quem já é membro', async () => {
    const { workspaceId, owner, member } = await scenario();
    const notFound = await api()
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(owner.auth)
      .send({ email: 'naoexiste@teste.com' })
      .expect(404);
    expect(notFound.body.error.code).toBe('USER_NOT_FOUND');
    await api()
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(owner.auth)
      .send({ email: member.email })
      .expect(409);
  });

  it('admin não adiciona administradores; membro não adiciona ninguém', async () => {
    const { workspaceId, admin, member, stranger } = await scenario();
    await api()
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(admin.auth)
      .send({ email: stranger.email, role: 'ADMIN' })
      .expect(403);
    await api()
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(member.auth)
      .send({ email: stranger.email })
      .expect(403);
  });

  it('não aceita convidar alguém como dono (400)', async () => {
    const { workspaceId, owner, stranger } = await scenario();
    await api()
      .post(`/api/workspaces/${workspaceId}/members`)
      .set(owner.auth)
      .send({ email: stranger.email, role: 'OWNER' })
      .expect(400);
  });

  it('altera papéis respeitando a hierarquia', async () => {
    const { workspaceId, owner, admin, member, observer } = await scenario();
    const url = (id: string) => `/api/workspaces/${workspaceId}/members/${id}`;

    await api().patch(url(observer.id)).set(admin.auth).send({ role: 'MEMBER' }).expect(200);
    await api().patch(url(member.id)).set(admin.auth).send({ role: 'ADMIN' }).expect(403);
    await api().patch(url(owner.id)).set(admin.auth).send({ role: 'MEMBER' }).expect(403);
    await api().patch(url(admin.id)).set(member.auth).send({ role: 'OBSERVER' }).expect(403);
    const res = await api()
      .patch(url(member.id))
      .set(owner.auth)
      .send({ role: 'ADMIN' })
      .expect(200);
    expect(res.body.role).toBe('ADMIN');
    await api().patch(url('inexistente')).set(owner.auth).send({ role: 'MEMBER' }).expect(404);
    await api().patch(url(member.id)).set(owner.auth).send({ role: 'CHEFE' }).expect(400);
  });

  it('transfere a propriedade: o dono antigo vira admin', async () => {
    const { workspaceId, owner, member } = await scenario();
    await api()
      .patch(`/api/workspaces/${workspaceId}/members/${member.id}`)
      .set(owner.auth)
      .send({ role: 'OWNER' })
      .expect(200);
    const res = await api()
      .get(`/api/workspaces/${workspaceId}/members`)
      .set(owner.auth)
      .expect(200);
    const roles = Object.fromEntries(
      res.body.map((m: { userId: string; role: string }) => [m.userId, m.role]),
    );
    expect(roles[member.id]).toBe('OWNER');
    expect(roles[owner.id]).toBe('ADMIN');
  });

  it('remove membros e permite sair; o dono não pode sair', async () => {
    const { workspaceId, owner, admin, member, observer, board } = await scenario();
    const url = (id: string) => `/api/workspaces/${workspaceId}/members/${id}`;

    // Atribuição some quando a pessoa sai.
    const columnId = board.columns[0]!.id;
    const card = await api()
      .post(`/api/columns/${columnId}/cards`)
      .set(owner.auth)
      .send({ title: 'Tarefa', assigneeIds: [member.id] })
      .expect(201);

    await api().delete(url(admin.id)).set(member.auth).expect(403);
    await api().delete(url(admin.id)).set(admin.auth).expect(204); // sair
    await api().delete(url(member.id)).set(owner.auth).expect(204);
    await api().delete(url(observer.id)).set(observer.auth).expect(204);

    const left = await api().delete(url(owner.id)).set(owner.auth).expect(400);
    expect(left.body.error.code).toBe('OWNER_CANNOT_LEAVE');
    await api().delete(url('ninguem')).set(owner.auth).expect(404);

    const detail = await api().get(`/api/cards/${card.body.id}`).set(owner.auth).expect(200);
    expect(detail.body.assigneeIds).toEqual([]);
    await api().get(`/api/workspaces/${workspaceId}`).set(member.auth).expect(404);
  });

  it('admin não remove outro admin', async () => {
    const { workspaceId, owner, admin } = await scenario();
    const other = await createUser();
    await addMember(owner, workspaceId, other, 'ADMIN');
    await api()
      .delete(`/api/workspaces/${workspaceId}/members/${other.id}`)
      .set(admin.auth)
      .expect(403);
  });
});
