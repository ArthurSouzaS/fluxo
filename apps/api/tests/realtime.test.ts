import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type {
  BoardEventEnvelope,
  ClientToServerEvents,
  JoinBoardAck,
  Notification,
  PresencePayload,
  ServerToClientEvents,
} from '@fluxo/shared';
import { attachRealtime } from '../src/realtime/socket';
import { api, app, createCard, scenario, type TestUser } from './helpers';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: http.Server;
let realtime: ReturnType<typeof attachRealtime>;
let url: string;
const sockets: ClientSocket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  realtime = attachRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.disconnect();
});

afterAll(async () => {
  await realtime.close();
  await new Promise((resolve) => server.close(resolve));
});

function open(user: TestUser | { token: string }): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket: ClientSocket = connect(url, {
      auth: { token: user.token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function join(socket: ClientSocket, boardId: string) {
  return new Promise<JoinBoardAck>((resolve) => socket.emit('board:join', boardId, resolve));
}

function next<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E,
  predicate: (...args: Parameters<ServerToClientEvents[E]>) => boolean = () => true,
  timeout = 3000,
) {
  return new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Evento ${event} não recebido`)), timeout);
    const handler = ((...args: Parameters<ServerToClientEvents[E]>) => {
      if (!predicate(...args)) return;
      clearTimeout(timer);
      socket.off(event, handler as never);
      resolve(args[0]);
    }) as ServerToClientEvents[E];
    socket.on(event, handler as never);
  });
}

/** Garante que nenhum evento chega dentro da janela. */
function nothing(socket: ClientSocket, event: keyof ServerToClientEvents, wait = 400) {
  return new Promise<void>((resolve, reject) => {
    const handler = () => reject(new Error(`Evento ${event} inesperado`));
    socket.on(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, wait);
  });
}

describe('Socket.io', () => {
  it('recusa conexões sem token válido', async () => {
    await expect(open({ token: 'invalido' })).rejects.toThrow('UNAUTHORIZED');
  });

  it('só deixa membros entrarem na sala do quadro', async () => {
    const { board, observer, stranger } = await scenario();
    expect(await join(await open(observer), board.id)).toEqual({ ok: true });
    expect(await join(await open(stranger), board.id)).toEqual({
      ok: false,
      error: 'Quadro não encontrado',
    });
  });

  it('mostra quem está online no quadro', async () => {
    const { board, owner, member } = await scenario();
    const a = await open(owner);
    await join(a, board.id);
    const update = next(a, 'presence:update', (p: PresencePayload) => p.users.length === 2);
    const b = await open(member);
    await join(b, board.id);
    const presence = await update;
    expect(presence.users.map((u) => u.id).sort()).toEqual([owner.id, member.id].sort());

    const left = next(a, 'presence:update', (p: PresencePayload) => p.users.length === 1);
    b.disconnect();
    expect((await left).users[0]!.id).toBe(owner.id);
  });

  it('envia a movimentação de cartão para os outros, sem ecoar para quem moveu', async () => {
    const { board, owner, member } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const mover = await open(owner);
    const watcher = await open(member);
    await join(mover, board.id);
    await join(watcher, board.id);

    const received = next(
      watcher,
      'board:event',
      (e: BoardEventEnvelope) => e.event.type === 'card.moved',
    );
    const silent = nothing(mover, 'board:event');
    await api()
      .post(`/api/cards/${card.id}/move`)
      .set(owner.auth)
      .set('x-socket-id', mover.id!)
      .send({ columnId: board.columns[1]!.id, index: 0 })
      .expect(200);

    const envelope = await received;
    expect(envelope).toMatchObject({
      boardId: board.id,
      actorId: owner.id,
      event: {
        type: 'card.moved',
        fromColumnId: board.columns[0]!.id,
        card: { id: card.id, columnId: board.columns[1]!.id },
      },
    });
    await silent;
  });

  it('propaga edição e comentários', async () => {
    const { board, owner, member } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const watcher = await open(member);
    await join(watcher, board.id);

    const updated = next(
      watcher,
      'board:event',
      (e: BoardEventEnvelope) => e.event.type === 'card.updated',
    );
    await api()
      .patch(`/api/cards/${card.id}`)
      .set(owner.auth)
      .send({ title: 'Renomeado' })
      .expect(200);
    expect((await updated).event).toMatchObject({ card: { title: 'Renomeado' } });

    const commented = next(
      watcher,
      'board:event',
      (e: BoardEventEnvelope) => e.event.type === 'comment.created',
    );
    await api()
      .post(`/api/cards/${card.id}/comments`)
      .set(owner.auth)
      .send({ body: 'Olá!' })
      .expect(201);
    expect((await commented).event).toMatchObject({ comment: { body: 'Olá!', cardId: card.id } });
  });

  it('entrega notificações de menção em tempo real, em todas as abas do usuário', async () => {
    const { board, owner, member } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const tab1 = await open(member);
    const tab2 = await open(member);
    const n1 = next(tab1, 'notification:new');
    const n2 = next(tab2, 'notification:new');
    await api()
      .post(`/api/cards/${card.id}/comments`)
      .set(owner.auth)
      .send({ body: `@${member.username} dá uma olhada` })
      .expect(201);
    const [a, b] = (await Promise.all([n1, n2])) as Notification[];
    expect(a).toMatchObject({ type: 'MENTION', data: { cardId: card.id } });
    expect(b!.id).toBe(a!.id);
  });

  it('remove da sala quem deixa de ser membro', async () => {
    const { board, owner, member, workspaceId } = await scenario();
    const watcher = await open(member);
    await join(watcher, board.id);
    await api()
      .delete(`/api/workspaces/${workspaceId}/members/${member.id}`)
      .set(owner.auth)
      .expect(204);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const silent = nothing(watcher, 'board:event');
    await createCard(owner, board.columns[0]!.id);
    await silent;
  });
});

describe('Socket.io — origem do evento', () => {
  it('ignora x-socket-id de outra pessoa (não silencia o evento dela)', async () => {
    const { board, owner, member } = await scenario();
    const card = await createCard(owner, board.columns[0]!.id);
    const victim = await open(member);
    await join(victim, board.id);
    const received = next(
      victim,
      'board:event',
      (e: BoardEventEnvelope) => e.event.type === 'card.updated',
    );
    await api()
      .patch(`/api/cards/${card.id}`)
      .set(owner.auth)
      .set('x-socket-id', victim.id!)
      .send({ title: 'Ainda chega' })
      .expect(200);
    expect((await received).event).toMatchObject({ card: { title: 'Ainda chega' } });
  });
});
