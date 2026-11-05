import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, createCard, scenario } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

describe('Cartões', () => {
  it('cria cartão com responsáveis, etiquetas e prazo, e notifica os responsáveis', async () => {
    const { board, owner, member } = await scenario();
    const res = await api()
      .post(`/api/columns/${board.columns[0]!.id}/cards`)
      .set(owner.auth)
      .send({
        title: 'Tela de login',
        description: '## Critérios',
        dueDate: new Date(Date.now() + DAY).toISOString(),
        assigneeIds: [member.id, owner.id],
        labelIds: [board.labels[0]!.id],
      })
      .expect(201);
    expect(res.body).toMatchObject({
      title: 'Tela de login',
      hasDescription: true,
      assigneeIds: [member.id, owner.id],
      labelIds: [board.labels[0]!.id],
      completedAt: null,
    });

    const notifications = await api().get('/api/notifications').set(member.auth).expect(200);
    expect(notifications.body.data[0]).toMatchObject({ type: 'ASSIGNED' });
    // Quem cria não notifica a si mesmo.
    const own = await api().get('/api/notifications').set(owner.auth).expect(200);
    expect(own.body.data).toHaveLength(0);
  });

  it('cartão criado em coluna concluída já nasce concluído', async () => {
    const { board, owner } = await scenario();
    const card = await createCard(owner, board.columns[2]!.id);
    const res = await api().get(`/api/cards/${card.id}`).set(owner.auth).expect(200);
    expect(res.body.completedAt).not.toBeNull();
  });

  it('recusa responsável de fora do workspace e etiqueta de outro quadro (400)', async () => {
    const { board, owner, stranger } = await scenario();
    const columnId = board.columns[0]!.id;
    const assignee = await api()
      .post(`/api/columns/${columnId}/cards`)
      .set(owner.auth)
      .send({ title: 'X', assigneeIds: [stranger.id] })
      .expect(400);
    expect(assignee.body.error.code).toBe('INVALID_ASSIGNEE');
    const label = await api()
      .post(`/api/columns/${columnId}/cards`)
      .set(owner.auth)
      .send({ title: 'X', labelIds: ['outra'] })
      .expect(400);
    expect(label.body.error.code).toBe('INVALID_LABEL');
  });

  it('valida título e data (400) e aplica permissões', async () => {
    const { board, owner, observer, stranger } = await scenario();
    const columnId = board.columns[0]!.id;
    await api()
      .post(`/api/columns/${columnId}/cards`)
      .set(owner.auth)
      .send({ title: '  ' })
      .expect(400);
    await api()
      .post(`/api/columns/${columnId}/cards`)
      .set(owner.auth)
      .send({ title: 'X', dueDate: 'amanhã' })
      .expect(400);
    await api()
      .post(`/api/columns/${columnId}/cards`)
      .set(observer.auth)
      .send({ title: 'X' })
      .expect(403);
    await api()
      .post(`/api/columns/${columnId}/cards`)
      .set(stranger.auth)
      .send({ title: 'X' })
      .expect(404);
  });

  it('detalha o cartão com checklists, anexos e coluna', async () => {
    const { board, owner, observer, stranger } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id, { assigneeIds: [owner.id] });
    const res = await api().get(`/api/cards/${card.id}`).set(observer.auth).expect(200);
    expect(res.body).toMatchObject({
      id: card.id,
      columnTitle: 'A fazer',
      workspaceId: board.workspaceId,
      checklists: [],
      attachments: [],
    });
    expect(res.body.assignees[0]).toMatchObject({ id: owner.id });
    expect(res.body.createdBy).toMatchObject({ id: owner.id });
    await api().get(`/api/cards/${card.id}`).set(stranger.auth).expect(404);
  });

  it('atualiza campos e registra no histórico', async () => {
    const { board, member } = await scenario();
    const card = await createCard(member, board.columns[0]!.id);
    const res = await api()
      .patch(`/api/cards/${card.id}`)
      .set(member.auth)
      .send({ title: 'Novo título', description: 'Texto', dueDate: null })
      .expect(200);
    expect(res.body).toMatchObject({ title: 'Novo título', hasDescription: true, dueDate: null });

    const activities = await api()
      .get(`/api/cards/${card.id}/activities`)
      .set(member.auth)
      .expect(200);
    const types = activities.body.data.map((a: { type: string }) => a.type);
    expect(types).toEqual(
      expect.arrayContaining(['card.created', 'card.updated', 'card.due_changed']),
    );
  });

  it('arquiva cartões (somem do quadro, mas podem ser listados)', async () => {
    const { board, owner } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    await api().patch(`/api/cards/${card.id}`).set(owner.auth).send({ archived: true }).expect(200);
    const detail = await api().get(`/api/boards/${board.id}`).set(owner.auth).expect(200);
    expect(detail.body.cards).toHaveLength(0);
    const archived = await api()
      .get(`/api/boards/${board.id}/cards?archived=true`)
      .set(owner.auth)
      .expect(200);
    expect(archived.body.data[0].id).toBe(card.id);
  });

  it('exclui o cartão (membro sim, observador não)', async () => {
    const { board, owner, observer } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    await api().delete(`/api/cards/${card.id}`).set(observer.auth).expect(403);
    await api().delete(`/api/cards/${card.id}`).set(owner.auth).expect(204);
    await api().get(`/api/cards/${card.id}`).set(owner.auth).expect(404);
  });
});

describe('Mover cartões', () => {
  it('reordena dentro da mesma coluna', async () => {
    const { board, owner } = await scenario();
    const columnId = board.columns[0]!.id;
    const a = await createCard(owner, columnId, { title: 'A' });
    const b = await createCard(owner, columnId, { title: 'B' });
    const c = await createCard(owner, columnId, { title: 'C' });

    await api()
      .post(`/api/cards/${c.id}/move`)
      .set(owner.auth)
      .send({ columnId, index: 0 })
      .expect(200);
    const res = await api().get(`/api/boards/${board.id}`).set(owner.auth).expect(200);
    expect(res.body.cards.map((card: { id: string }) => card.id)).toEqual([c.id, a.id, b.id]);
  });

  it('move entre colunas, conclui ao entrar na coluna "Concluído" e reabre ao sair', async () => {
    const { board, owner } = await scenario();
    const [todo, , done] = board.columns;
    const card = await createCard(owner, todo!.id, { title: 'Deploy' });

    const moved = await api()
      .post(`/api/cards/${card.id}/move`)
      .set(owner.auth)
      .send({ columnId: done!.id, index: 0 })
      .expect(200);
    expect(moved.body.columnId).toBe(done!.id);
    expect(moved.body.completedAt).not.toBeNull();

    const reopened = await api()
      .post(`/api/cards/${card.id}/move`)
      .set(owner.auth)
      .send({ columnId: todo!.id, index: 0 })
      .expect(200);
    expect(reopened.body.completedAt).toBeNull();

    const activities = await api()
      .get(`/api/boards/${board.id}/activities`)
      .set(owner.auth)
      .expect(200);
    const types = activities.body.data.map((a: { type: string }) => a.type);
    expect(types).toContain('card.completed');
    expect(types).toContain('card.moved');
  });

  it('renumera posições quando não há espaço entre vizinhos', async () => {
    const { board, owner } = await scenario();
    const columnId = board.columns[0]!.id;
    const a = await createCard(owner, columnId, { title: 'A' });
    const b = await createCard(owner, columnId, { title: 'B' });
    const c = await createCard(owner, columnId, { title: 'C' });
    await prisma.card.update({ where: { id: a.id }, data: { position: 1 } });
    await prisma.card.update({ where: { id: b.id }, data: { position: 1.0001 } });

    await api()
      .post(`/api/cards/${c.id}/move`)
      .set(owner.auth)
      .send({ columnId, index: 1 })
      .expect(200);
    const res = await api().get(`/api/boards/${board.id}`).set(owner.auth).expect(200);
    expect(res.body.cards.map((card: { id: string }) => card.id)).toEqual([a.id, c.id, b.id]);
    expect(res.body.cards.map((card: { position: number }) => card.position)).toEqual([
      1024, 2048, 3072,
    ]);
  });

  it('recusa coluna de outro quadro (404) e observador (403)', async () => {
    const { board, owner, observer, workspaceId } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const other = await api()
      .post(`/api/workspaces/${workspaceId}/boards`)
      .set(owner.auth)
      .send({ title: 'Outro' })
      .expect(201);
    await api()
      .post(`/api/cards/${card.id}/move`)
      .set(owner.auth)
      .send({ columnId: other.body.columns[0].id, index: 0 })
      .expect(404);
    await api()
      .post(`/api/cards/${card.id}/move`)
      .set(observer.auth)
      .send({ columnId: board.columns[1]!.id, index: 0 })
      .expect(403);
    await api().post(`/api/cards/${card.id}/move`).set(owner.auth).send({ index: 0 }).expect(400);
  });
});

describe('Responsáveis e etiquetas', () => {
  it('define responsáveis, notifica os novos e registra entradas/saídas', async () => {
    const { board, owner, member, admin } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id, { assigneeIds: [admin.id] });
    const res = await api()
      .put(`/api/cards/${card.id}/assignees`)
      .set(owner.auth)
      .send({ userIds: [member.id, member.id] })
      .expect(200);
    expect(res.body.assigneeIds).toEqual([member.id]);

    const activities = await api()
      .get(`/api/cards/${card.id}/activities`)
      .set(owner.auth)
      .expect(200);
    const types = activities.body.data.map((a: { type: string }) => a.type);
    expect(types).toEqual(expect.arrayContaining(['card.assigned', 'card.unassigned']));
    const notifications = await api().get('/api/notifications').set(member.auth).expect(200);
    const types2 = notifications.body.data.map((n: { type: string }) => n.type);
    expect(types2).toEqual(['ASSIGNED', 'MEMBER_ADDED']);
  });

  it('recusa responsável de fora e permite limpar a lista', async () => {
    const { board, owner, stranger } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id, { assigneeIds: [owner.id] });
    await api()
      .put(`/api/cards/${card.id}/assignees`)
      .set(owner.auth)
      .send({ userIds: [stranger.id] })
      .expect(400);
    const res = await api()
      .put(`/api/cards/${card.id}/assignees`)
      .set(owner.auth)
      .send({ userIds: [] })
      .expect(200);
    expect(res.body.assigneeIds).toEqual([]);
  });

  it('define etiquetas do próprio quadro', async () => {
    const { board, owner, observer } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const labelIds = board.labels.slice(0, 2).map((l) => l.id);
    const res = await api()
      .put(`/api/cards/${card.id}/labels`)
      .set(owner.auth)
      .send({ labelIds })
      .expect(200);
    expect(res.body.labelIds.sort()).toEqual([...labelIds].sort());
    await api()
      .put(`/api/cards/${card.id}/labels`)
      .set(owner.auth)
      .send({ labelIds: ['x'] })
      .expect(400);
    await api()
      .put(`/api/cards/${card.id}/labels`)
      .set(observer.auth)
      .send({ labelIds: [] })
      .expect(403);
  });
});

describe('Listagem, busca e filtros', () => {
  async function seedCards() {
    const ctx = await scenario();
    const { board, owner, member } = ctx;
    const [todo, doing, done] = board.columns;
    const bug = board.labels.find((l) => l.name === 'Bug')!;
    await createCard(owner, todo!.id, {
      title: 'Corrigir login',
      labelIds: [bug.id],
      dueDate: new Date(Date.now() - 2 * DAY).toISOString(),
    });
    await createCard(owner, todo!.id, {
      title: 'Tela de cadastro',
      description: 'Formulário com validação do login',
      assigneeIds: [member.id],
      dueDate: new Date(Date.now() + 3 * DAY).toISOString(),
    });
    await createCard(owner, doing!.id, { title: 'Dashboard' });
    await createCard(owner, done!.id, { title: 'Configurar CI', assigneeIds: [member.id] });
    return ctx;
  }

  const titles = (body: { data: Array<{ title: string }> }) => body.data.map((c) => c.title).sort();

  it('pagina os resultados com metadados', async () => {
    const { board, owner } = await seedCards();
    const res = await api()
      .get(`/api/boards/${board.id}/cards?page=2&pageSize=3`)
      .set(owner.auth)
      .expect(200);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 3, total: 4, totalPages: 2 });
    expect(res.body.data).toHaveLength(1);
  });

  it('busca no título e na descrição, sem diferenciar maiúsculas', async () => {
    const { board, owner } = await seedCards();
    const res = await api()
      .get(`/api/boards/${board.id}/cards?q=LOGIN`)
      .set(owner.auth)
      .expect(200);
    expect(titles(res.body)).toEqual(['Corrigir login', 'Tela de cadastro']);
  });

  it('filtra por etiqueta, responsável, status e prazo', async () => {
    const { board, owner, member } = await seedCards();
    const bug = board.labels.find((l) => l.name === 'Bug')!;
    const get = async (query: string) =>
      titles(
        (await api().get(`/api/boards/${board.id}/cards?${query}`).set(owner.auth).expect(200))
          .body,
      );

    expect(await get(`labelIds=${bug.id}`)).toEqual(['Corrigir login']);
    expect(await get(`assigneeIds=${member.id}`)).toEqual(['Configurar CI', 'Tela de cadastro']);
    expect(await get('status=done')).toEqual(['Configurar CI']);
    expect(await get('status=open')).toHaveLength(3);
    expect(await get('due=overdue')).toEqual(['Corrigir login']);
    expect(await get('due=week')).toEqual(['Tela de cadastro']);
    expect(await get('due=none')).toEqual(['Configurar CI', 'Dashboard']);
    expect(await get(`assigneeIds=${member.id}&status=open`)).toEqual(['Tela de cadastro']);
  });

  it('ordena por prazo e valida parâmetros', async () => {
    const { board, owner } = await seedCards();
    const res = await api()
      .get(`/api/boards/${board.id}/cards?sort=dueDate`)
      .set(owner.auth)
      .expect(200);
    expect(res.body.data[0].title).toBe('Corrigir login');
    expect(res.body.data.at(-1).dueDate).toBeNull();
    await api().get(`/api/boards/${board.id}/cards?pageSize=500`).set(owner.auth).expect(400);
    await api().get(`/api/boards/${board.id}/cards?due=ontem`).set(owner.auth).expect(400);
  });

  it('esconde cartões de quadros de outros workspaces (404)', async () => {
    const { board, stranger } = await seedCards();
    await api().get(`/api/boards/${board.id}/cards`).set(stranger.auth).expect(404);
  });
});
