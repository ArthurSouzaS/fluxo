import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { uploadDir } from '../src/modules/attachments/storage';
import { api, createCard, scenario } from './helpers';

describe('Etiquetas', () => {
  it('CRUD de etiquetas com permissões', async () => {
    const { board, member, observer, stranger } = await scenario();
    const created = await api()
      .post(`/api/boards/${board.id}/labels`)
      .set(member.auth)
      .send({ name: 'Design', color: '#a78bfa' })
      .expect(201);
    expect(created.body).toMatchObject({ name: 'Design', color: '#a78bfa', boardId: board.id });

    const list = await api().get(`/api/boards/${board.id}/labels`).set(observer.auth).expect(200);
    expect(list.body).toHaveLength(5);

    await api()
      .patch(`/api/labels/${created.body.id}`)
      .set(member.auth)
      .send({ name: 'UI' })
      .expect(200);
    await api()
      .patch(`/api/labels/${created.body.id}`)
      .set(member.auth)
      .send({ color: 'azul' })
      .expect(400);
    await api()
      .patch(`/api/labels/${created.body.id}`)
      .set(observer.auth)
      .send({ name: 'X' })
      .expect(403);
    await api().get(`/api/boards/${board.id}/labels`).set(stranger.auth).expect(404);
    await api()
      .post(`/api/boards/${board.id}/labels`)
      .set(observer.auth)
      .send({ name: 'X', color: '#000000' })
      .expect(403);
    await api().delete(`/api/labels/${created.body.id}`).set(member.auth).expect(204);
    await api().delete(`/api/labels/${created.body.id}`).set(member.auth).expect(404);
  });
});

describe('Checklists', () => {
  it('cria checklist, itens, marca progresso e reflete no resumo do cartão', async () => {
    const { board, member, observer } = await scenario();
    const card = await createCard(member, board.columns[0]!.id);

    const checklist = await api()
      .post(`/api/cards/${card.id}/checklists`)
      .set(member.auth)
      .send({ title: 'Entrega' })
      .expect(201);
    const checklistId = checklist.body.id;

    await api()
      .post(`/api/checklists/${checklistId}/items`)
      .set(member.auth)
      .send({ text: 'Back-end' })
      .expect(201);
    const withItems = await api()
      .post(`/api/checklists/${checklistId}/items`)
      .set(member.auth)
      .send({ text: 'Front-end' })
      .expect(201);
    expect(withItems.body.items.map((i: { text: string }) => i.text)).toEqual([
      'Back-end',
      'Front-end',
    ]);

    const itemId = withItems.body.items[0].id;
    const toggled = await api()
      .patch(`/api/checklist-items/${itemId}`)
      .set(member.auth)
      .send({ done: true })
      .expect(200);
    expect(toggled.body.items[0].done).toBe(true);

    const detail = await api().get(`/api/boards/${board.id}`).set(member.auth).expect(200);
    expect(detail.body.cards[0].checklist).toEqual({ done: 1, total: 2 });

    const activities = await api()
      .get(`/api/cards/${card.id}/activities`)
      .set(member.auth)
      .expect(200);
    expect(activities.body.data.map((a: { type: string }) => a.type)).toContain(
      'checklist.item_completed',
    );

    await api()
      .patch(`/api/checklists/${checklistId}`)
      .set(member.auth)
      .send({ title: 'Sprint' })
      .expect(200);
    await api()
      .patch(`/api/checklist-items/${itemId}`)
      .set(member.auth)
      .send({ text: '' })
      .expect(400);
    await api()
      .patch(`/api/checklist-items/${itemId}`)
      .set(observer.auth)
      .send({ done: false })
      .expect(403);
    await api()
      .post(`/api/cards/${card.id}/checklists`)
      .set(observer.auth)
      .send({ title: 'X' })
      .expect(403);

    const afterDelete = await api()
      .delete(`/api/checklist-items/${itemId}`)
      .set(member.auth)
      .expect(200);
    expect(afterDelete.body.items).toHaveLength(1);
    await api().delete(`/api/checklists/${checklistId}`).set(member.auth).expect(204);
    await api().delete(`/api/checklists/${checklistId}`).set(member.auth).expect(404);
    await api()
      .patch('/api/checklist-items/inexistente')
      .set(member.auth)
      .send({ done: true })
      .expect(404);
  });
});

describe('Comentários e menções', () => {
  it('comenta, notifica mencionados e responsáveis (sem duplicar)', async () => {
    const { board, owner, member, admin, stranger } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id, {
      title: 'API de login',
      assigneeIds: [admin.id, member.id],
    });
    // Limpa notificações de atribuição/convite para isolar o teste.
    await prisma.notification.deleteMany();

    const res = await api()
      .post(`/api/cards/${card.id}/comments`)
      .set(owner.auth)
      .send({ body: `@${member.username} pode revisar? cc @${stranger.username} @ninguem` })
      .expect(201);
    expect(res.body).toMatchObject({
      body: expect.stringContaining('revisar'),
      author: { id: owner.id },
    });

    const memberNotes = await api().get('/api/notifications').set(member.auth).expect(200);
    expect(memberNotes.body.data).toHaveLength(1);
    expect(memberNotes.body.data[0]).toMatchObject({
      type: 'MENTION',
      message: 'Dona Ana mencionou você em "API de login"',
      data: { cardId: card.id, boardId: board.id },
    });
    const adminNotes = await api().get('/api/notifications').set(admin.auth).expect(200);
    expect(adminNotes.body.data[0].type).toBe('COMMENT');
    // Estranho mencionado não é membro: não recebe nada.
    const strangerNotes = await api().get('/api/notifications').set(stranger.auth).expect(200);
    expect(strangerNotes.body.data).toHaveLength(0);
  });

  it('lista comentários paginados, do mais recente para o mais antigo', async () => {
    const { board, member } = await scenario();
    const card = await createCard(member, board.columns[0]!.id);
    for (const body of ['primeiro', 'segundo', 'terceiro']) {
      await api()
        .post(`/api/cards/${card.id}/comments`)
        .set(member.auth)
        .send({ body })
        .expect(201);
    }
    const res = await api()
      .get(`/api/cards/${card.id}/comments?pageSize=2`)
      .set(member.auth)
      .expect(200);
    expect(res.body.data.map((c: { body: string }) => c.body)).toEqual(['terceiro', 'segundo']);
    expect(res.body.meta.total).toBe(3);

    const detail = await api().get(`/api/boards/${board.id}`).set(member.auth).expect(200);
    expect(detail.body.cards[0].commentCount).toBe(3);
  });

  it('só o autor edita; autor ou dono/admin excluem; observador não comenta', async () => {
    const { board, owner, member, admin, observer } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const comment = await api()
      .post(`/api/cards/${card.id}/comments`)
      .set(member.auth)
      .send({ body: 'Oi' })
      .expect(201);
    const id = comment.body.id;

    await api()
      .post(`/api/cards/${card.id}/comments`)
      .set(observer.auth)
      .send({ body: 'Oi' })
      .expect(403);
    await api()
      .post(`/api/cards/${card.id}/comments`)
      .set(member.auth)
      .send({ body: '   ' })
      .expect(400);
    await api().patch(`/api/comments/${id}`).set(admin.auth).send({ body: 'Editado' }).expect(403);
    const edited = await api()
      .patch(`/api/comments/${id}`)
      .set(member.auth)
      .send({ body: 'Editado' })
      .expect(200);
    expect(edited.body.body).toBe('Editado');
    await api().delete(`/api/comments/${id}`).set(observer.auth).expect(403);
    await api().delete(`/api/comments/${id}`).set(admin.auth).expect(204);
    await api().delete(`/api/comments/${id}`).set(member.auth).expect(404);
  });
});

describe('Anexos', () => {
  it('envia, baixa e remove um anexo', async () => {
    const { board, member } = await scenario();
    const card = await createCard(member, board.columns[0]!.id);
    const upload = await api()
      .post(`/api/cards/${card.id}/attachments`)
      .set(member.auth)
      .attach('file', Buffer.from('conteúdo do relatório'), {
        filename: 'relatório.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    expect(upload.body).toMatchObject({
      fileName: 'relatório.txt',
      mimeType: 'text/plain',
      uploader: { id: member.id },
    });

    const stored = await prisma.attachment.findUniqueOrThrow({ where: { id: upload.body.id } });
    expect(stored.storedName).not.toContain('relat');
    expect(fs.existsSync(path.join(uploadDir, stored.storedName))).toBe(true);

    const download = await api()
      .get(`/api/attachments/${upload.body.id}/download`)
      .set(member.auth)
      .expect(200);
    expect(download.text).toBe('conteúdo do relatório');
    expect(download.headers['content-disposition']).toContain('attachment');

    const detail = await api().get(`/api/cards/${card.id}`).set(member.auth).expect(200);
    expect(detail.body.attachmentCount).toBe(1);

    await api().delete(`/api/attachments/${upload.body.id}`).set(member.auth).expect(204);
    expect(fs.existsSync(path.join(uploadDir, stored.storedName))).toBe(false);
  });

  it('recusa tipos não permitidos, extensão trocada e falta de arquivo (400)', async () => {
    const { board, member } = await scenario();
    const card = await createCard(member, board.columns[0]!.id);
    const url = `/api/cards/${card.id}/attachments`;
    const exe = await api()
      .post(url)
      .set(member.auth)
      .attach('file', Buffer.from('MZ'), {
        filename: 'virus.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400);
    expect(exe.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    await api()
      .post(url)
      .set(member.auth)
      .attach('file', Buffer.from('<html>'), { filename: 'pagina.html', contentType: 'image/png' })
      .expect(400);
    const missing = await api().post(url).set(member.auth).field('nome', 'x').expect(400);
    expect(missing.body.error.code).toBe('FILE_MISSING');
  });

  it('recusa arquivos acima do limite (413)', async () => {
    const { board, member } = await scenario();
    const card = await createCard(member, board.columns[0]!.id);
    const res = await api()
      .post(`/api/cards/${card.id}/attachments`)
      .set(member.auth)
      .attach('file', Buffer.alloc(1024 * 1024 + 10, 'a'), {
        filename: 'grande.txt',
        contentType: 'text/plain',
      })
      .expect(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('aplica permissões de envio, download e remoção', async () => {
    const { board, owner, member, admin, observer, stranger } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const file = { filename: 'a.txt', contentType: 'text/plain' };
    await api()
      .post(`/api/cards/${card.id}/attachments`)
      .set(observer.auth)
      .attach('file', Buffer.from('a'), file)
      .expect(403);
    await api()
      .post(`/api/cards/${card.id}/attachments`)
      .set(stranger.auth)
      .attach('file', Buffer.from('a'), file)
      .expect(404);

    const upload = await api()
      .post(`/api/cards/${card.id}/attachments`)
      .set(owner.auth)
      .attach('file', Buffer.from('a'), file)
      .expect(201);
    await api().get(`/api/attachments/${upload.body.id}/download`).set(observer.auth).expect(200);
    await api().get(`/api/attachments/${upload.body.id}/download`).set(stranger.auth).expect(404);
    await api().delete(`/api/attachments/${upload.body.id}`).set(member.auth).expect(403);
    await api().delete(`/api/attachments/${upload.body.id}`).set(admin.auth).expect(204);
  });
});

describe('Notificações', () => {
  it('lista, conta não lidas, marca uma e todas como lidas', async () => {
    const { board, owner, member, admin } = await scenario();
    await createCard(owner, board.columns[0]!.id, { assigneeIds: [member.id] });
    await createCard(owner, board.columns[0]!.id, { assigneeIds: [member.id] });

    const list = await api().get('/api/notifications').set(member.auth).expect(200);
    expect(list.body.unreadCount).toBe(3); // convite + 2 atribuições
    const first = list.body.data[0];

    const read = await api()
      .post(`/api/notifications/${first.id}/read`)
      .set(member.auth)
      .expect(200);
    expect(read.body.readAt).not.toBeNull();
    await api().post(`/api/notifications/${first.id}/read`).set(admin.auth).expect(404);

    const unread = await api().get('/api/notifications?unread=true').set(member.auth).expect(200);
    expect(unread.body.data).toHaveLength(2);

    const all = await api().post('/api/notifications/read-all').set(member.auth).expect(200);
    expect(all.body.updated).toBe(2);
    const after = await api().get('/api/notifications').set(member.auth).expect(200);
    expect(after.body.unreadCount).toBe(0);
  });
});

describe('Busca global, histórico e estatísticas', () => {
  it('busca quadros e cartões apenas nos workspaces do usuário', async () => {
    const { board, owner, stranger } = await scenario();
    await createCard(owner, board.columns[0]!.id, { title: 'Relatório financeiro' });
    const res = await api().get('/api/search?q=relat').set(owner.auth).expect(200);
    expect(res.body.cards[0]).toMatchObject({
      title: 'Relatório financeiro',
      boardTitle: 'Quadro Teste',
      columnTitle: 'A fazer',
    });
    const boards = await api().get('/api/search?q=quadro').set(owner.auth).expect(200);
    expect(boards.body.boards[0]).toMatchObject({ id: board.id, workspaceName: 'Equipe Teste' });

    const strangerRes = await api().get('/api/search?q=relat').set(stranger.auth).expect(200);
    expect(strangerRes.body).toEqual({ boards: [], cards: [] });
    await api().get('/api/search?q=a').set(owner.auth).expect(400);
  });

  it('histórico do quadro paginado e protegido', async () => {
    const { board, owner, stranger } = await scenario();
    await createCard(owner, board.columns[0]!.id);
    const res = await api()
      .get(`/api/boards/${board.id}/activities?pageSize=1`)
      .set(owner.auth)
      .expect(200);
    expect(res.body.data[0]).toMatchObject({ type: 'card.created', actor: { id: owner.id } });
    expect(res.body.meta.total).toBe(2);
    await api().get(`/api/boards/${board.id}/activities`).set(stranger.auth).expect(404);
  });

  it('estatísticas do quadro', async () => {
    const { board, owner, member, stranger } = await scenario();
    const [todo, , done] = board.columns;
    await createCard(owner, todo!.id, {
      assigneeIds: [member.id],
      dueDate: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await createCard(owner, done!.id, { assigneeIds: [member.id] });
    const res = await api().get(`/api/boards/${board.id}/stats`).set(owner.auth).expect(200);
    expect(res.body.totals).toEqual({ total: 2, open: 1, done: 1, overdue: 1, dueThisWeek: 0 });
    expect(res.body.byAssignee[0]).toMatchObject({ userId: member.id, open: 1, done: 1 });
    expect(res.body.completedPerWeek.at(-1).count).toBe(1);
    await api().get(`/api/boards/${board.id}/stats`).set(stranger.auth).expect(404);
  });
});
