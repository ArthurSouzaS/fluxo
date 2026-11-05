/**
 * API simulada do modo demonstração (MSW). Implementa as mesmas rotas e
 * formatos da API real, reaproveitando os schemas Zod, as regras de
 * permissão, a ordenação e o cálculo de estatísticas do pacote compartilhado.
 */
import { http, HttpResponse, type HttpResponseResolver } from 'msw';
import { ZodError, type z } from 'zod';
import {
  addMemberSchema,
  can,
  canChangeRole,
  canRemoveMember,
  changePasswordSchema,
  commentBodySchema,
  computeBoardStats,
  createBoardSchema,
  createCardSchema,
  createChecklistItemSchema,
  createChecklistSchema,
  createColumnSchema,
  createLabelSchema,
  createWorkspaceSchema,
  extractMentions,
  loginSchema,
  moveCardSchema,
  moveColumnSchema,
  positionForIndex,
  rebalancePositions,
  registerSchema,
  ROLE_LABELS,
  setAssigneesSchema,
  setLabelsSchema,
  slugifyUsername,
  updateBoardSchema,
  updateCardSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
  updateColumnSchema,
  updateLabelSchema,
  updateMemberSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
  type ActivityType,
  type Permission,
  type Role,
} from '@fluxo/shared';
import { API_URL } from '@/lib/config';
import {
  loadDemoDb,
  newId,
  saveDemoDb,
  type DCard,
  type DemoDb,
  type DNotification,
  type DUser,
} from './db';

const SESSION_KEY = 'fluxo:demo-session';
const MAX_UPLOAD = 500 * 1024;

let db: DemoDb = loadDemoDb();
export function replaceDb(next: DemoDb) {
  db = next;
  saveDemoDb(db);
}

const url = (path: string) => `${API_URL}/api${path}`;
const nowIso = () => new Date().toISOString();

class DemoError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const notFound = (message = 'Recurso não encontrado') => new DemoError(404, 'NOT_FOUND', message);
const forbidden = (message = 'Você não tem permissão para esta ação') =>
  new DemoError(403, 'FORBIDDEN', message);

/** Envolve o handler: autenticação, erros no formato da API e persistência. */
function route(
  resolver: (ctx: {
    userId: string;
    params: Record<string, string>;
    request: Request;
    body: () => Promise<unknown>;
  }) => unknown,
  auth = true,
): HttpResponseResolver {
  return async ({ request, params }) => {
    try {
      let userId = '';
      if (auth) {
        const header = request.headers.get('authorization') ?? '';
        userId = header.startsWith('Bearer demo-') ? header.slice('Bearer demo-'.length) : '';
        if (!db.users.some((user) => user.id === userId)) {
          return HttpResponse.json(
            { error: { code: 'TOKEN_INVALID', message: 'Sessão expirada' } },
            { status: 401 },
          );
        }
      }
      // Pequeno atraso para parecer uma rede de verdade.
      await new Promise((resolve) => setTimeout(resolve, 120));
      const result = await resolver({
        userId,
        params: params as Record<string, string>,
        request,
        body: () =>
          request
            .clone()
            .json()
            .catch(() => ({})),
      });
      if (request.method !== 'GET') saveDemoDb(db);
      if (result instanceof Response) return result;
      if (result === undefined) return new HttpResponse(null, { status: 204 });
      const [status, data] =
        Array.isArray(result) && typeof result[0] === 'number' ? result : [200, result];
      return HttpResponse.json(data, { status });
    } catch (error) {
      if (error instanceof DemoError) {
        return HttpResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }
      if (error instanceof ZodError) {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: error.issues[0]?.message ?? 'Dados inválidos',
              details: error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            },
          },
          { status: 400 },
        );
      }
      console.error(error);
      return HttpResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Erro interno (demonstração)' } },
        { status: 500 },
      );
    }
  };
}

const parse = <T extends z.ZodType>(schema: T, value: unknown): z.infer<T> => schema.parse(value);
const query = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);

// ---------------------------------------------------------------------------
// Mapeadores (mesmo formato da API real)
// ---------------------------------------------------------------------------

const userPublic = (user: DUser) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  avatarColor: user.avatarColor,
});
const userProfile = (user: DUser) => ({
  ...userPublic(user),
  email: user.email,
  createdAt: user.createdAt,
});
const userById = (id: string | null) => (id ? db.users.find((user) => user.id === id) : undefined);
const publicOrNull = (id: string | null) => {
  const user = userById(id);
  return user ? userPublic(user) : null;
};

function session(user: DUser) {
  localStorage.setItem(SESSION_KEY, user.id);
  return { user: userProfile(user), accessToken: `demo-${user.id}` };
}

function member(workspaceId: string, userId: string) {
  const m = db.members.find(
    (entry) => entry.workspaceId === workspaceId && entry.userId === userId,
  )!;
  const user = userById(userId)!;
  return {
    userId,
    role: m.role,
    joinedAt: m.joinedAt,
    user: { ...userPublic(user), email: user.email },
  };
}

function cardSummary(card: DCard) {
  const items = db.checklists
    .filter((checklist) => checklist.cardId === card.id)
    .flatMap((checklist) => checklist.items);
  return {
    id: card.id,
    boardId: card.boardId,
    columnId: card.columnId,
    title: card.title,
    position: card.position,
    dueDate: card.dueDate,
    completedAt: card.completedAt,
    archived: card.archived,
    hasDescription: card.description.trim().length > 0,
    labelIds: card.labelIds,
    assigneeIds: card.assigneeIds,
    commentCount: db.comments.filter((comment) => comment.cardId === card.id).length,
    attachmentCount: db.attachments.filter((attachment) => attachment.cardId === card.id).length,
    checklist: { done: items.filter((item) => item.done).length, total: items.length },
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

const commentDto = (comment: DemoDb['comments'][number]) => ({
  ...comment,
  author: publicOrNull(comment.authorId)!,
  authorId: undefined,
});
const attachmentDto = (attachment: DemoDb['attachments'][number]) => ({
  id: attachment.id,
  cardId: attachment.cardId,
  fileName: attachment.fileName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  uploader: publicOrNull(attachment.uploaderId),
  createdAt: attachment.createdAt,
});
const checklistDto = (checklistId: string) => {
  const checklist = db.checklists.find((entry) => entry.id === checklistId)!;
  return { ...checklist, items: [...checklist.items].sort((a, b) => a.position - b.position) };
};

function paginate<T>(items: T[], request: Request, defaultSize = 20) {
  const q = query(request);
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || defaultSize));
  return {
    data: items.slice((page - 1) * pageSize, page * pageSize),
    meta: {
      page,
      pageSize,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    },
  };
}

// ---------------------------------------------------------------------------
// Acesso
// ---------------------------------------------------------------------------

function roleIn(workspaceId: string, userId: string): Role {
  const m = db.members.find(
    (entry) => entry.workspaceId === workspaceId && entry.userId === userId,
  );
  if (!m) throw notFound('Workspace não encontrado');
  return m.role;
}

function requireWorkspace(userId: string, workspaceId: string, permission?: Permission) {
  const role = roleIn(workspaceId, userId);
  if (permission && !can(role, permission)) throw forbidden();
  return role;
}

function requireBoard(userId: string, boardId: string, permission?: Permission) {
  const board = db.boards.find((entry) => entry.id === boardId);
  if (!board) throw notFound('Quadro não encontrado');
  const role = requireWorkspace(userId, board.workspaceId, permission);
  return { board, role };
}

function requireCard(userId: string, cardId: string, permission?: Permission) {
  const card = db.cards.find((entry) => entry.id === cardId);
  if (!card) throw notFound('Cartão não encontrado');
  return { card, ...requireBoard(userId, card.boardId, permission) };
}

function log(
  workspaceId: string,
  boardId: string | null,
  cardId: string | null,
  actorId: string,
  type: ActivityType,
  data: Record<string, unknown> = {},
) {
  db.activities.push({
    id: newId('a'),
    workspaceId,
    boardId,
    cardId,
    actorId,
    type,
    data,
    createdAt: nowIso(),
  });
}

function notify(entry: Omit<DNotification, 'id' | 'readAt' | 'createdAt'>) {
  if (entry.userId === entry.actorId) return;
  db.notifications.push({ ...entry, id: newId('n'), readAt: null, createdAt: nowIso() });
}

function boardDetail(boardId: string, userId: string) {
  const { board, role } = requireBoard(userId, boardId);
  const workspace = db.workspaces.find((ws) => ws.id === board.workspaceId)!;
  return {
    ...board,
    workspaceName: workspace.name,
    myRole: role,
    columns: db.columns
      .filter((column) => column.boardId === boardId)
      .sort((a, b) => a.position - b.position),
    cards: db.cards
      .filter((card) => card.boardId === boardId && !card.archived)
      .sort((a, b) => a.position - b.position)
      .map(cardSummary),
    labels: db.labels.filter((label) => label.boardId === boardId),
    members: db.members
      .filter((m) => m.workspaceId === board.workspaceId)
      .map((m) => member(m.workspaceId, m.userId)),
  };
}

function workspaceSummary(workspaceId: string, userId: string) {
  const ws = db.workspaces.find((entry) => entry.id === workspaceId)!;
  return {
    ...ws,
    role: roleIn(workspaceId, userId),
    memberCount: db.members.filter((m) => m.workspaceId === workspaceId).length,
    boardCount: db.boards.filter((board) => board.workspaceId === workspaceId && !board.archived)
      .length,
  };
}

function setPosition<T extends { id: string; position: number }>(
  siblings: T[],
  item: T,
  index: number,
) {
  const sorted = siblings
    .filter((entry) => entry.id !== item.id)
    .sort((a, b) => a.position - b.position);
  const position = positionForIndex(
    sorted.map((entry) => entry.position),
    index,
  );
  if (position !== null) {
    item.position = position;
    return;
  }
  const clamped = Math.max(0, Math.min(index, sorted.length));
  const positions = rebalancePositions(sorted.length + 1);
  sorted.forEach((entry, i) => (entry.position = positions[i >= clamped ? i + 1 : i]!));
  item.position = positions[clamped]!;
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

export const handlers = [
  // Autenticação --------------------------------------------------------------
  http.post(
    url('/auth/login'),
    route(async ({ body }) => {
      const input = parse(loginSchema, await body());
      const user = db.users.find((entry) => entry.email === input.email);
      if (!user || user.password !== input.password)
        throw new DemoError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos');
      return session(user);
    }, false),
  ),

  http.post(
    url('/auth/register'),
    route(async ({ body }) => {
      const input = parse(registerSchema, await body());
      if (db.users.some((user) => user.email === input.email))
        throw new DemoError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado');
      let username = slugifyUsername(input.name).slice(0, 20);
      for (let i = 2; db.users.some((user) => user.username === username); i += 1)
        username = `${slugifyUsername(input.name).slice(0, 20)}${i}`;
      const user: DUser = {
        id: newId('u'),
        name: input.name,
        email: input.email,
        username,
        avatarColor: '#38bdf8',
        password: input.password,
        createdAt: nowIso(),
      };
      db.users.push(user);
      const workspaceId = newId('w');
      db.workspaces.push({
        id: workspaceId,
        name: `Espaço de ${input.name.split(' ')[0]}`,
        description: 'Seu workspace pessoal.',
        createdAt: nowIso(),
      });
      db.members.push({ workspaceId, userId: user.id, role: 'OWNER', joinedAt: nowIso() });
      return [201, session(user)];
    }, false),
  ),

  http.post(
    url('/auth/refresh'),
    route(() => {
      const user = userById(localStorage.getItem(SESSION_KEY));
      if (!user) throw new DemoError(401, 'REFRESH_MISSING', 'Sessão expirada');
      return session(user);
    }, false),
  ),

  http.post(
    url('/auth/logout'),
    route(() => {
      localStorage.removeItem(SESSION_KEY);
    }, false),
  ),

  http.post(
    url('/auth/change-password'),
    route(async ({ userId, body }) => {
      const input = parse(changePasswordSchema, await body());
      const user = userById(userId)!;
      if (user.password !== input.currentPassword)
        throw new DemoError(401, 'INVALID_PASSWORD', 'Senha atual incorreta');
      user.password = input.newPassword;
      return session(user);
    }),
  ),

  http.get(
    url('/users/me'),
    route(({ userId }) => userProfile(userById(userId)!)),
  ),
  http.patch(
    url('/users/me'),
    route(async ({ userId, body }) => {
      const input = parse(updateProfileSchema, await body());
      if (
        input.username &&
        db.users.some((user) => user.username === input.username && user.id !== userId)
      ) {
        throw new DemoError(409, 'USERNAME_TAKEN', 'Este apelido já está em uso');
      }
      const user = userById(userId)!;
      Object.assign(user, input);
      return userProfile(user);
    }),
  ),

  // Workspaces e membros --------------------------------------------------------
  http.get(
    url('/workspaces'),
    route(({ userId }) =>
      db.members
        .filter((m) => m.userId === userId)
        .map((m) => workspaceSummary(m.workspaceId, userId)),
    ),
  ),
  http.post(
    url('/workspaces'),
    route(async ({ userId, body }) => {
      const input = parse(createWorkspaceSchema, await body());
      const id = newId('w');
      db.workspaces.push({
        id,
        name: input.name,
        description: input.description || null,
        createdAt: nowIso(),
      });
      db.members.push({ workspaceId: id, userId, role: 'OWNER', joinedAt: nowIso() });
      log(id, null, null, userId, 'workspace.created');
      return [201, workspaceSummary(id, userId)];
    }),
  ),
  http.get(
    url('/workspaces/:id'),
    route(({ userId, params }) => {
      requireWorkspace(userId, params.id!);
      return workspaceSummary(params.id!, userId);
    }),
  ),
  http.patch(
    url('/workspaces/:id'),
    route(async ({ userId, params, body }) => {
      requireWorkspace(userId, params.id!, 'workspace:update');
      const input = parse(updateWorkspaceSchema, await body());
      const ws = db.workspaces.find((entry) => entry.id === params.id)!;
      if (input.name) ws.name = input.name;
      if (input.description !== undefined) ws.description = input.description || null;
      return workspaceSummary(ws.id, userId);
    }),
  ),
  http.delete(
    url('/workspaces/:id'),
    route(({ userId, params }) => {
      requireWorkspace(userId, params.id!, 'workspace:delete');
      const boardIds = new Set(
        db.boards.filter((board) => board.workspaceId === params.id).map((board) => board.id),
      );
      db.workspaces = db.workspaces.filter((ws) => ws.id !== params.id);
      db.members = db.members.filter((m) => m.workspaceId !== params.id);
      db.boards = db.boards.filter((board) => !boardIds.has(board.id));
      db.columns = db.columns.filter((column) => !boardIds.has(column.boardId));
      db.cards = db.cards.filter((card) => !boardIds.has(card.boardId));
    }),
  ),
  http.get(
    url('/workspaces/:id/members'),
    route(({ userId, params }) => {
      requireWorkspace(userId, params.id!);
      const order: Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'OBSERVER'];
      return db.members
        .filter((m) => m.workspaceId === params.id)
        .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
        .map((m) => member(m.workspaceId, m.userId));
    }),
  ),
  http.post(
    url('/workspaces/:id/members'),
    route(async ({ userId, params, body }) => {
      const actorRole = requireWorkspace(userId, params.id!, 'member:manage');
      const input = parse(addMemberSchema, await body());
      if (input.role === 'ADMIN' && actorRole !== 'OWNER')
        throw forbidden('Apenas o dono pode adicionar administradores');
      const user = db.users.find((entry) => entry.email === input.email);
      if (!user)
        throw new DemoError(404, 'USER_NOT_FOUND', 'Nenhum usuário cadastrado com este e-mail');
      if (db.members.some((m) => m.workspaceId === params.id && m.userId === user.id)) {
        throw new DemoError(409, 'ALREADY_MEMBER', 'Esta pessoa já é membro do workspace');
      }
      db.members.push({
        workspaceId: params.id!,
        userId: user.id,
        role: input.role,
        joinedAt: nowIso(),
      });
      log(params.id!, null, null, userId, 'member.added', { userName: user.name });
      return [201, member(params.id!, user.id)];
    }),
  ),
  http.patch(
    url('/workspaces/:id/members/:userId'),
    route(async ({ userId, params, body }) => {
      const actorRole = requireWorkspace(userId, params.id!, 'member:manage');
      const input = parse(updateMemberSchema, await body());
      const target = db.members.find(
        (m) => m.workspaceId === params.id && m.userId === params.userId,
      );
      if (!target) throw notFound('Membro não encontrado');
      if (
        !canChangeRole(
          { id: userId, role: actorRole },
          { id: target.userId, role: target.role },
          input.role,
        )
      ) {
        throw forbidden('Você não pode alterar o papel deste membro');
      }
      if (input.role === 'OWNER')
        db.members.find((m) => m.workspaceId === params.id && m.userId === userId)!.role = 'ADMIN';
      target.role = input.role;
      log(params.id!, null, null, userId, 'member.role_changed', {
        userName: userById(target.userId)!.name,
        role: ROLE_LABELS[input.role],
      });
      return member(params.id!, target.userId);
    }),
  ),
  http.delete(
    url('/workspaces/:id/members/:userId'),
    route(({ userId, params }) => {
      const actorRole = roleIn(params.id!, userId);
      const target = db.members.find(
        (m) => m.workspaceId === params.id && m.userId === params.userId,
      );
      if (!target) throw notFound('Membro não encontrado');
      if (
        !canRemoveMember({ id: userId, role: actorRole }, { id: target.userId, role: target.role })
      ) {
        if (target.role === 'OWNER')
          throw new DemoError(
            400,
            'OWNER_CANNOT_LEAVE',
            'O dono não pode sair do workspace. Transfira a propriedade antes.',
          );
        throw forbidden('Você não pode remover este membro');
      }
      db.members = db.members.filter((m) => m !== target);
      const boardIds = new Set(
        db.boards.filter((board) => board.workspaceId === params.id).map((board) => board.id),
      );
      for (const card of db.cards) {
        if (boardIds.has(card.boardId))
          card.assigneeIds = card.assigneeIds.filter((id) => id !== target.userId);
      }
    }),
  ),

  // Quadros ---------------------------------------------------------------------
  http.get(
    url('/workspaces/:id/boards'),
    route(({ userId, params, request }) => {
      requireWorkspace(userId, params.id!);
      const archived = query(request).archived === 'true';
      return db.boards
        .filter((board) => board.workspaceId === params.id && board.archived === archived)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((board) => ({
          ...board,
          cardCount: db.cards.filter((card) => card.boardId === board.id && !card.archived).length,
        }));
    }),
  ),
  http.post(
    url('/workspaces/:id/boards'),
    route(async ({ userId, params, body }) => {
      requireWorkspace(userId, params.id!, 'board:create');
      const input = parse(createBoardSchema, await body());
      const id = newId('b');
      db.boards.push({
        id,
        workspaceId: params.id!,
        title: input.title,
        description: input.description || null,
        color: input.color ?? '#38bdf8',
        archived: false,
        createdById: userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      const titles = {
        kanban: ['A fazer', 'Em andamento', 'Concluído'],
        scrum: ['Backlog', 'A fazer', 'Em andamento', 'Em revisão', 'Concluído'],
        blank: [],
      }[input.template];
      titles.forEach((title, index) =>
        db.columns.push({
          id: newId('c'),
          boardId: id,
          title,
          position: (index + 1) * 1024,
          wipLimit: null,
          isDone: title === 'Concluído',
        }),
      );
      if (input.template !== 'blank') {
        for (const [name, color] of [
          ['Bug', '#f87171'],
          ['Melhoria', '#34d399'],
          ['Urgente', '#fb923c'],
          ['Documentação', '#38bdf8'],
        ] as const) {
          db.labels.push({ id: newId('l'), boardId: id, name, color });
        }
      }
      log(params.id!, id, null, userId, 'board.created', { boardTitle: input.title });
      return [201, boardDetail(id, userId)];
    }),
  ),
  http.get(
    url('/boards/:id'),
    route(({ userId, params }) => boardDetail(params.id!, userId)),
  ),
  http.patch(
    url('/boards/:id'),
    route(async ({ userId, params, body }) => {
      const { board } = requireBoard(userId, params.id!, 'board:update');
      const input = parse(updateBoardSchema, await body());
      Object.assign(board, input, { updatedAt: nowIso() });
      if (input.description !== undefined) board.description = input.description || null;
      return boardDetail(board.id, userId);
    }),
  ),
  http.delete(
    url('/boards/:id'),
    route(({ userId, params }) => {
      requireBoard(userId, params.id!, 'board:delete');
      db.boards = db.boards.filter((board) => board.id !== params.id);
      db.cards = db.cards.filter((card) => card.boardId !== params.id);
      db.columns = db.columns.filter((column) => column.boardId !== params.id);
    }),
  ),
  http.get(
    url('/boards/:id/stats'),
    route(({ userId, params }) => {
      const { board } = requireBoard(userId, params.id!);
      return computeBoardStats({
        columns: db.columns.filter((column) => column.boardId === board.id),
        cards: db.cards.filter((card) => card.boardId === board.id && !card.archived),
        members: db.members
          .filter((m) => m.workspaceId === board.workspaceId)
          .map((m) => userById(m.userId)!),
        labels: db.labels.filter((label) => label.boardId === board.id),
      });
    }),
  ),
  http.get(
    url('/boards/:id/activities'),
    route(({ userId, params, request }) => {
      requireBoard(userId, params.id!);
      const list = db.activities
        .filter((activity) => activity.boardId === params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((activity) => ({ ...activity, actor: publicOrNull(activity.actorId) }));
      return paginate(list, request);
    }),
  ),

  // Colunas ---------------------------------------------------------------------
  http.post(
    url('/boards/:id/columns'),
    route(async ({ userId, params, body }) => {
      requireBoard(userId, params.id!, 'column:manage');
      const input = parse(createColumnSchema, await body());
      const last = Math.max(
        0,
        ...db.columns
          .filter((column) => column.boardId === params.id)
          .map((column) => column.position),
      );
      const column = {
        id: newId('c'),
        boardId: params.id!,
        title: input.title,
        position: last + 1024,
        wipLimit: input.wipLimit ?? null,
        isDone: input.isDone ?? false,
      };
      db.columns.push(column);
      return [201, column];
    }),
  ),
  http.patch(
    url('/columns/:id'),
    route(async ({ userId, params, body }) => {
      const column = db.columns.find((entry) => entry.id === params.id);
      if (!column) throw notFound('Coluna não encontrada');
      requireBoard(userId, column.boardId, 'column:manage');
      const input = parse(updateColumnSchema, await body());
      if (input.isDone !== undefined && input.isDone !== column.isDone) {
        for (const card of db.cards.filter((entry) => entry.columnId === column.id)) {
          card.completedAt = input.isDone ? (card.completedAt ?? nowIso()) : null;
        }
      }
      Object.assign(column, input);
      return column;
    }),
  ),
  http.post(
    url('/columns/:id/move'),
    route(async ({ userId, params, body }) => {
      const column = db.columns.find((entry) => entry.id === params.id);
      if (!column) throw notFound('Coluna não encontrada');
      requireBoard(userId, column.boardId, 'column:manage');
      const input = parse(moveColumnSchema, await body());
      setPosition(
        db.columns.filter((entry) => entry.boardId === column.boardId),
        column,
        input.index,
      );
      return column;
    }),
  ),
  http.delete(
    url('/columns/:id'),
    route(({ userId, params }) => {
      const column = db.columns.find((entry) => entry.id === params.id);
      if (!column) throw notFound('Coluna não encontrada');
      requireBoard(userId, column.boardId, 'column:manage');
      db.columns = db.columns.filter((entry) => entry !== column);
      db.cards = db.cards.filter((card) => card.columnId !== column.id);
    }),
  ),

  // Cartões ---------------------------------------------------------------------
  http.post(
    url('/columns/:id/cards'),
    route(async ({ userId, params, body }) => {
      const column = db.columns.find((entry) => entry.id === params.id);
      if (!column) throw notFound('Coluna não encontrada');
      const { board } = requireBoard(userId, column.boardId, 'card:write');
      const input = parse(createCardSchema, await body());
      const last = Math.max(
        0,
        ...db.cards.filter((card) => card.columnId === column.id).map((card) => card.position),
      );
      const card: DCard = {
        id: newId('k'),
        boardId: board.id,
        columnId: column.id,
        title: input.title,
        description: input.description ?? '',
        position: last + 1024,
        dueDate: input.dueDate ?? null,
        completedAt: column.isDone ? nowIso() : null,
        archived: false,
        createdById: userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        assigneeIds: input.assigneeIds ?? [],
        labelIds: input.labelIds ?? [],
      };
      db.cards.push(card);
      log(board.workspaceId, board.id, card.id, userId, 'card.created', {
        cardTitle: card.title,
        columnTitle: column.title,
      });
      return [201, cardSummary(card)];
    }),
  ),
  http.get(
    url('/cards/:id'),
    route(({ userId, params }) => {
      const { card, board } = requireCard(userId, params.id!);
      return {
        ...cardSummary(card),
        description: card.description,
        workspaceId: board.workspaceId,
        columnTitle: db.columns.find((column) => column.id === card.columnId)?.title ?? '',
        createdBy: publicOrNull(card.createdById),
        assignees: card.assigneeIds.map((id) => publicOrNull(id)).filter(Boolean),
        labels: db.labels.filter((label) => card.labelIds.includes(label.id)),
        checklists: db.checklists
          .filter((checklist) => checklist.cardId === card.id)
          .sort((a, b) => a.position - b.position)
          .map((checklist) => checklistDto(checklist.id)),
        attachments: db.attachments
          .filter((attachment) => attachment.cardId === card.id)
          .reverse()
          .map(attachmentDto),
      };
    }),
  ),
  http.patch(
    url('/cards/:id'),
    route(async ({ userId, params, body }) => {
      const { card, board } = requireCard(userId, params.id!, 'card:write');
      const input = parse(updateCardSchema, await body());
      Object.assign(card, input, { updatedAt: nowIso() });
      if (input.archived)
        log(board.workspaceId, board.id, card.id, userId, 'card.archived', {
          cardTitle: card.title,
        });
      else if (input.dueDate !== undefined)
        log(board.workspaceId, board.id, card.id, userId, 'card.due_changed', {
          cardTitle: card.title,
          dueDate: input.dueDate,
        });
      else
        log(board.workspaceId, board.id, card.id, userId, 'card.updated', {
          cardTitle: card.title,
        });
      return cardSummary(card);
    }),
  ),
  http.post(
    url('/cards/:id/move'),
    route(async ({ userId, params, body }) => {
      const { card, board } = requireCard(userId, params.id!, 'card:write');
      const input = parse(moveCardSchema, await body());
      const target = db.columns.find(
        (column) => column.id === input.columnId && column.boardId === board.id,
      );
      if (!target) throw notFound('Coluna de destino não encontrada');
      const source = db.columns.find((column) => column.id === card.columnId)!;
      setPosition(
        db.cards.filter((entry) => entry.columnId === target.id && !entry.archived),
        card,
        input.index,
      );
      card.columnId = target.id;
      card.completedAt = target.isDone ? (card.completedAt ?? nowIso()) : null;
      card.updatedAt = nowIso();
      if (source.id !== target.id) {
        log(
          board.workspaceId,
          board.id,
          card.id,
          userId,
          target.isDone && !source.isDone ? 'card.completed' : 'card.moved',
          {
            cardTitle: card.title,
            fromColumn: source.title,
            toColumn: target.title,
          },
        );
      }
      return cardSummary(card);
    }),
  ),
  http.delete(
    url('/cards/:id'),
    route(({ userId, params }) => {
      const { card, board } = requireCard(userId, params.id!, 'card:write');
      db.cards = db.cards.filter((entry) => entry !== card);
      log(board.workspaceId, board.id, null, userId, 'card.deleted', { cardTitle: card.title });
    }),
  ),
  http.put(
    url('/cards/:id/assignees'),
    route(async ({ userId, params, body }) => {
      const { card, board } = requireCard(userId, params.id!, 'card:write');
      const input = parse(setAssigneesSchema, await body());
      const ids = [...new Set(input.userIds)];
      if (
        ids.some(
          (id) => !db.members.some((m) => m.workspaceId === board.workspaceId && m.userId === id),
        )
      ) {
        throw new DemoError(400, 'INVALID_ASSIGNEE', 'Só é possível atribuir membros do workspace');
      }
      const actor = userById(userId)!;
      for (const id of ids.filter((id) => !card.assigneeIds.includes(id))) {
        log(board.workspaceId, board.id, card.id, userId, 'card.assigned', {
          cardTitle: card.title,
          userName: userById(id)!.name,
        });
        notify({
          userId: id,
          actorId: userId,
          type: 'ASSIGNED',
          message: `${actor.name} atribuiu você ao cartão "${card.title}"`,
          data: { boardId: board.id, cardId: card.id },
        });
      }
      card.assigneeIds = ids;
      return cardSummary(card);
    }),
  ),
  http.put(
    url('/cards/:id/labels'),
    route(async ({ userId, params, body }) => {
      const { card, board } = requireCard(userId, params.id!, 'card:write');
      const input = parse(setLabelsSchema, await body());
      if (
        input.labelIds.some(
          (id) => !db.labels.some((label) => label.id === id && label.boardId === board.id),
        )
      ) {
        throw new DemoError(400, 'INVALID_LABEL', 'Etiqueta inválida para este quadro');
      }
      card.labelIds = [...new Set(input.labelIds)];
      log(board.workspaceId, board.id, card.id, userId, 'card.labeled', { cardTitle: card.title });
      return cardSummary(card);
    }),
  ),
  http.get(
    url('/cards/:id/activities'),
    route(({ userId, params, request }) => {
      requireCard(userId, params.id!);
      const list = db.activities
        .filter((activity) => activity.cardId === params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((activity) => ({ ...activity, actor: publicOrNull(activity.actorId) }));
      return paginate(list, request);
    }),
  ),

  // Comentários -----------------------------------------------------------------
  http.get(
    url('/cards/:id/comments'),
    route(({ userId, params, request }) => {
      requireCard(userId, params.id!);
      const list = db.comments
        .filter((comment) => comment.cardId === params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(commentDto);
      return paginate(list, request);
    }),
  ),
  http.post(
    url('/cards/:id/comments'),
    route(async ({ userId, params, body }) => {
      const { card, board } = requireCard(userId, params.id!, 'comment:create');
      const input = parse(commentBodySchema, await body());
      const comment = {
        id: newId('m'),
        cardId: card.id,
        authorId: userId,
        body: input.body,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.comments.push(comment);
      log(board.workspaceId, board.id, card.id, userId, 'comment.created', {
        cardTitle: card.title,
      });
      const author = userById(userId)!;
      const mentioned = new Set<string>();
      for (const username of extractMentions(input.body)) {
        const user = db.users.find((entry) => entry.username === username);
        if (
          !user ||
          !db.members.some((m) => m.workspaceId === board.workspaceId && m.userId === user.id)
        )
          continue;
        mentioned.add(user.id);
        notify({
          userId: user.id,
          actorId: userId,
          type: 'MENTION',
          message: `${author.name} mencionou você em "${card.title}"`,
          data: { boardId: board.id, cardId: card.id, commentId: comment.id },
        });
      }
      for (const id of card.assigneeIds.filter((id) => !mentioned.has(id))) {
        notify({
          userId: id,
          actorId: userId,
          type: 'COMMENT',
          message: `${author.name} comentou em "${card.title}"`,
          data: { boardId: board.id, cardId: card.id, commentId: comment.id },
        });
      }
      return [201, commentDto(comment)];
    }),
  ),
  http.patch(
    url('/comments/:id'),
    route(async ({ userId, params, body }) => {
      const comment = db.comments.find((entry) => entry.id === params.id);
      if (!comment) throw notFound('Comentário não encontrado');
      requireCard(userId, comment.cardId, 'comment:create');
      if (comment.authorId !== userId) throw forbidden('Só o autor pode editar o comentário');
      comment.body = parse(commentBodySchema, await body()).body;
      comment.updatedAt = nowIso();
      return commentDto(comment);
    }),
  ),
  http.delete(
    url('/comments/:id'),
    route(({ userId, params }) => {
      const comment = db.comments.find((entry) => entry.id === params.id);
      if (!comment) throw notFound('Comentário não encontrado');
      const { role } = requireCard(userId, comment.cardId);
      if (comment.authorId !== userId && !can(role, 'comment:moderate'))
        throw forbidden('Você não pode excluir este comentário');
      db.comments = db.comments.filter((entry) => entry !== comment);
    }),
  ),

  // Checklists ------------------------------------------------------------------
  http.post(
    url('/cards/:id/checklists'),
    route(async ({ userId, params, body }) => {
      const { card } = requireCard(userId, params.id!, 'card:write');
      const input = parse(createChecklistSchema, await body());
      const id = newId('cl');
      db.checklists.push({
        id,
        cardId: card.id,
        title: input.title,
        position: Date.now(),
        items: [],
      });
      return [201, checklistDto(id)];
    }),
  ),
  http.patch(
    url('/checklists/:id'),
    route(async ({ userId, params, body }) => {
      const checklist = db.checklists.find((entry) => entry.id === params.id);
      if (!checklist) throw notFound('Checklist não encontrado');
      requireCard(userId, checklist.cardId, 'card:write');
      checklist.title = parse(updateChecklistSchema, await body()).title;
      return checklistDto(checklist.id);
    }),
  ),
  http.delete(
    url('/checklists/:id'),
    route(({ userId, params }) => {
      const checklist = db.checklists.find((entry) => entry.id === params.id);
      if (!checklist) throw notFound('Checklist não encontrado');
      requireCard(userId, checklist.cardId, 'card:write');
      db.checklists = db.checklists.filter((entry) => entry !== checklist);
    }),
  ),
  http.post(
    url('/checklists/:id/items'),
    route(async ({ userId, params, body }) => {
      const checklist = db.checklists.find((entry) => entry.id === params.id);
      if (!checklist) throw notFound('Checklist não encontrado');
      requireCard(userId, checklist.cardId, 'card:write');
      const input = parse(createChecklistItemSchema, await body());
      checklist.items.push({
        id: newId('i'),
        checklistId: checklist.id,
        text: input.text,
        done: false,
        position: Date.now(),
      });
      return [201, checklistDto(checklist.id)];
    }),
  ),
  http.patch(
    url('/checklist-items/:id'),
    route(async ({ userId, params, body }) => {
      const checklist = db.checklists.find((entry) =>
        entry.items.some((item) => item.id === params.id),
      );
      if (!checklist) throw notFound('Item não encontrado');
      const { card, board } = requireCard(userId, checklist.cardId, 'card:write');
      const input = parse(updateChecklistItemSchema, await body());
      const item = checklist.items.find((entry) => entry.id === params.id)!;
      if (input.done && !item.done)
        log(board.workspaceId, board.id, card.id, userId, 'checklist.item_completed', {
          cardTitle: card.title,
          itemText: item.text,
        });
      Object.assign(item, input);
      return checklistDto(checklist.id);
    }),
  ),
  http.delete(
    url('/checklist-items/:id'),
    route(({ userId, params }) => {
      const checklist = db.checklists.find((entry) =>
        entry.items.some((item) => item.id === params.id),
      );
      if (!checklist) throw notFound('Item não encontrado');
      requireCard(userId, checklist.cardId, 'card:write');
      checklist.items = checklist.items.filter((item) => item.id !== params.id);
      return checklistDto(checklist.id);
    }),
  ),

  // Etiquetas -------------------------------------------------------------------
  http.post(
    url('/boards/:id/labels'),
    route(async ({ userId, params, body }) => {
      requireBoard(userId, params.id!, 'label:manage');
      const input = parse(createLabelSchema, await body());
      const label = { id: newId('l'), boardId: params.id!, ...input };
      db.labels.push(label);
      return [201, label];
    }),
  ),
  http.patch(
    url('/labels/:id'),
    route(async ({ userId, params, body }) => {
      const label = db.labels.find((entry) => entry.id === params.id);
      if (!label) throw notFound('Etiqueta não encontrada');
      requireBoard(userId, label.boardId, 'label:manage');
      Object.assign(label, parse(updateLabelSchema, await body()));
      return label;
    }),
  ),
  http.delete(
    url('/labels/:id'),
    route(({ userId, params }) => {
      const label = db.labels.find((entry) => entry.id === params.id);
      if (!label) throw notFound('Etiqueta não encontrada');
      requireBoard(userId, label.boardId, 'label:manage');
      db.labels = db.labels.filter((entry) => entry !== label);
      for (const card of db.cards) card.labelIds = card.labelIds.filter((id) => id !== label.id);
    }),
  ),

  // Anexos (guardados só em memória) ----------------------------------------------
  http.post(
    url('/cards/:id/attachments'),
    route(async ({ userId, params, request }) => {
      const { card, board } = requireCard(userId, params.id!, 'attachment:upload');
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File))
        throw new DemoError(400, 'FILE_MISSING', 'Envie um arquivo no campo "file"');
      if (file.size > MAX_UPLOAD)
        throw new DemoError(
          413,
          'FILE_TOO_LARGE',
          'Na demonstração, os anexos podem ter até 500 KB',
        );
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const attachment = {
        id: newId('f'),
        cardId: card.id,
        uploaderId: userId,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        createdAt: nowIso(),
        dataUrl,
      };
      db.attachments.push(attachment);
      log(board.workspaceId, board.id, card.id, userId, 'attachment.added', {
        cardTitle: card.title,
        fileName: file.name,
      });
      return [201, attachmentDto(attachment)];
    }),
  ),
  http.get(
    url('/attachments/:id/download'),
    route(async ({ userId, params }) => {
      const attachment = db.attachments.find((entry) => entry.id === params.id);
      if (!attachment) throw notFound('Anexo não encontrado');
      requireCard(userId, attachment.cardId);
      if (!attachment.dataUrl)
        throw notFound('O arquivo foi descartado ao recarregar a demonstração');
      const blob = await (await fetch(attachment.dataUrl)).blob();
      return new HttpResponse(blob, { headers: { 'Content-Type': attachment.mimeType } });
    }),
  ),
  http.delete(
    url('/attachments/:id'),
    route(({ userId, params }) => {
      const attachment = db.attachments.find((entry) => entry.id === params.id);
      if (!attachment) throw notFound('Anexo não encontrado');
      requireCard(userId, attachment.cardId, 'attachment:upload');
      db.attachments = db.attachments.filter((entry) => entry !== attachment);
    }),
  ),

  // Notificações e busca ----------------------------------------------------------
  http.get(
    url('/notifications'),
    route(({ userId, request }) => {
      const mine = db.notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const list = query(request).unread === 'true' ? mine.filter((n) => !n.readAt) : mine;
      return {
        ...paginate(
          list.map((n) => ({ ...n, actor: publicOrNull(n.actorId) })),
          request,
        ),
        unreadCount: mine.filter((n) => !n.readAt).length,
      };
    }),
  ),
  http.post(
    url('/notifications/read-all'),
    route(({ userId }) => {
      const unread = db.notifications.filter((n) => n.userId === userId && !n.readAt);
      unread.forEach((n) => (n.readAt = nowIso()));
      return { updated: unread.length };
    }),
  ),
  http.post(
    url('/notifications/:id/read'),
    route(({ userId, params }) => {
      const notification = db.notifications.find((n) => n.id === params.id && n.userId === userId);
      if (!notification) throw notFound('Notificação não encontrada');
      notification.readAt ??= nowIso();
      return { ...notification, actor: publicOrNull(notification.actorId) };
    }),
  ),
  http.get(
    url('/search'),
    route(({ userId, request }) => {
      const q = (query(request).q ?? '').trim().toLowerCase();
      if (q.length < 2)
        throw new DemoError(400, 'VALIDATION_ERROR', 'Digite pelo menos 2 caracteres');
      const workspaceIds = new Set(
        db.members.filter((m) => m.userId === userId).map((m) => m.workspaceId),
      );
      const boards = db.boards.filter(
        (board) => workspaceIds.has(board.workspaceId) && !board.archived,
      );
      const boardIds = new Set(boards.map((board) => board.id));
      return {
        boards: boards
          .filter((board) => board.title.toLowerCase().includes(q))
          .slice(0, 8)
          .map((board) => ({
            id: board.id,
            title: board.title,
            color: board.color,
            workspaceName: db.workspaces.find((ws) => ws.id === board.workspaceId)!.name,
          })),
        cards: db.cards
          .filter(
            (card) =>
              boardIds.has(card.boardId) &&
              !card.archived &&
              (card.title.toLowerCase().includes(q) || card.description.toLowerCase().includes(q)),
          )
          .slice(0, 8)
          .map((card) => ({
            id: card.id,
            title: card.title,
            boardId: card.boardId,
            boardTitle: db.boards.find((board) => board.id === card.boardId)!.title,
            columnTitle: db.columns.find((column) => column.id === card.columnId)!.title,
            completedAt: card.completedAt,
          })),
      };
    }),
  ),
];
