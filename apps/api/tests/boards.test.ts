import { describe, expect, it } from 'vitest';
import { api, createBoard, createCard, createUser, createWorkspace, scenario } from './helpers';

describe('Quadros', () => {
  it('cria quadro kanban com colunas e etiquetas padrão', async () => {
    const user = await createUser();
    const workspaceId = await createWorkspace(user);
    const board = await createBoard(user, workspaceId, 'kanban');
    expect(board.columns.map((c) => c.title)).toEqual(['A fazer', 'Em andamento', 'Concluído']);
    expect(board.columns.at(-1)!.isDone).toBe(true);
    expect(board.labels).toHaveLength(4);
    expect(board.myRole).toBe('OWNER');
    expect(board.members).toHaveLength(1);
  });

  it('modelos scrum e em branco', async () => {
    const user = await createUser();
    const workspaceId = await createWorkspace(user);
    expect((await createBoard(user, workspaceId, 'scrum')).columns).toHaveLength(5);
    const blank = await createBoard(user, workspaceId, 'blank');
    expect(blank.columns).toHaveLength(0);
    expect(blank.labels).toHaveLength(0);
  });

  it('valida título e cor (400)', async () => {
    const user = await createUser();
    const workspaceId = await createWorkspace(user);
    await api()
      .post(`/api/workspaces/${workspaceId}/boards`)
      .set(user.auth)
      .send({ title: '' })
      .expect(400);
    await api()
      .post(`/api/workspaces/${workspaceId}/boards`)
      .set(user.auth)
      .send({ title: 'Ok', color: 'vermelho' })
      .expect(400);
  });

  it('observador não cria quadros (403); estranho recebe 404', async () => {
    const { workspaceId, observer, stranger } = await scenario();
    await api()
      .post(`/api/workspaces/${workspaceId}/boards`)
      .set(observer.auth)
      .send({ title: 'X' })
      .expect(403);
    await api()
      .post(`/api/workspaces/${workspaceId}/boards`)
      .set(stranger.auth)
      .send({ title: 'X' })
      .expect(404);
  });

  it('lista quadros com contagem de cartões e filtra arquivados', async () => {
    const { workspaceId, owner, board } = await scenario();
    await createCard(owner, board.columns[0]!.id);
    const res = await api()
      .get(`/api/workspaces/${workspaceId}/boards`)
      .set(owner.auth)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].cardCount).toBe(1);

    await api()
      .patch(`/api/boards/${board.id}`)
      .set(owner.auth)
      .send({ archived: true })
      .expect(200);
    const active = await api()
      .get(`/api/workspaces/${workspaceId}/boards`)
      .set(owner.auth)
      .expect(200);
    const archived = await api()
      .get(`/api/workspaces/${workspaceId}/boards?archived=true`)
      .set(owner.auth)
      .expect(200);
    expect(active.body).toHaveLength(0);
    expect(archived.body).toHaveLength(1);
  });

  it('detalha o quadro para membros e esconde de estranhos', async () => {
    const { board, observer, stranger } = await scenario();
    const res = await api().get(`/api/boards/${board.id}`).set(observer.auth).expect(200);
    expect(res.body).toMatchObject({
      id: board.id,
      myRole: 'OBSERVER',
      workspaceName: 'Equipe Teste',
    });
    expect(res.body.members).toHaveLength(4);
    await api().get(`/api/boards/${board.id}`).set(stranger.auth).expect(404);
    await api().get('/api/boards/inexistente').set(observer.auth).expect(404);
  });

  it('membro edita; observador não', async () => {
    const { board, member, observer } = await scenario();
    const res = await api()
      .patch(`/api/boards/${board.id}`)
      .set(member.auth)
      .send({ title: 'Sprint 1', color: '#a78bfa' })
      .expect(200);
    expect(res.body).toMatchObject({ title: 'Sprint 1', color: '#a78bfa' });
    await api()
      .patch(`/api/boards/${board.id}`)
      .set(observer.auth)
      .send({ title: 'X' })
      .expect(403);
  });

  it('somente dono/admin excluem o quadro', async () => {
    const { board, member, admin } = await scenario();
    await api().delete(`/api/boards/${board.id}`).set(member.auth).expect(403);
    await api().delete(`/api/boards/${board.id}`).set(admin.auth).expect(204);
    await api().get(`/api/boards/${board.id}`).set(admin.auth).expect(404);
  });
});

describe('Colunas', () => {
  it('cria coluna no fim do quadro', async () => {
    const { board, member } = await scenario();
    const res = await api()
      .post(`/api/boards/${board.id}/columns`)
      .set(member.auth)
      .send({ title: 'Homologação', wipLimit: 3 })
      .expect(201);
    expect(res.body).toMatchObject({ title: 'Homologação', wipLimit: 3, isDone: false });
    expect(res.body.position).toBeGreaterThan(board.columns.at(-1)!.position);
  });

  it('valida e aplica permissões', async () => {
    const { board, observer, member } = await scenario();
    await api()
      .post(`/api/boards/${board.id}/columns`)
      .set(member.auth)
      .send({ title: '' })
      .expect(400);
    await api()
      .post(`/api/boards/${board.id}/columns`)
      .set(member.auth)
      .send({ title: 'X', wipLimit: 0 })
      .expect(400);
    await api()
      .post(`/api/boards/${board.id}/columns`)
      .set(observer.auth)
      .send({ title: 'X' })
      .expect(403);
    await api().patch(`/api/columns/inexistente`).set(member.auth).send({ title: 'X' }).expect(404);
  });

  it('marcar a coluna como concluída conclui os cartões dela', async () => {
    const { board, owner } = await scenario();
    const column = board.columns[1]!;
    const card = await createCard(owner, column.id);
    await api()
      .patch(`/api/columns/${column.id}`)
      .set(owner.auth)
      .send({ isDone: true })
      .expect(200);
    const done = await api().get(`/api/cards/${card.id}`).set(owner.auth).expect(200);
    expect(done.body.completedAt).not.toBeNull();

    await api()
      .patch(`/api/columns/${column.id}`)
      .set(owner.auth)
      .send({ isDone: false })
      .expect(200);
    const reopened = await api().get(`/api/cards/${card.id}`).set(owner.auth).expect(200);
    expect(reopened.body.completedAt).toBeNull();
  });

  it('reordena colunas', async () => {
    const { board, owner } = await scenario();
    const [first, second, third] = board.columns;
    await api()
      .post(`/api/columns/${third!.id}/move`)
      .set(owner.auth)
      .send({ index: 0 })
      .expect(200);
    const res = await api().get(`/api/boards/${board.id}`).set(owner.auth).expect(200);
    expect(res.body.columns.map((c: { id: string }) => c.id)).toEqual([
      third!.id,
      first!.id,
      second!.id,
    ]);
    await api()
      .post(`/api/columns/${first!.id}/move`)
      .set(owner.auth)
      .send({ index: -1 })
      .expect(400);
  });

  it('exclui a coluna com os cartões', async () => {
    const { board, owner, observer } = await scenario();
    const column = board.columns[0]!;
    const card = await createCard(owner, column.id);
    await api().delete(`/api/columns/${column.id}`).set(observer.auth).expect(403);
    await api().delete(`/api/columns/${column.id}`).set(owner.auth).expect(204);
    await api().get(`/api/cards/${card.id}`).set(owner.auth).expect(404);
  });
});
