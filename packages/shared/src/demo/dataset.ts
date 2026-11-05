/**
 * Gera o conjunto completo de dados de exemplo (com ids e datas relativas).
 * É a fonte única usada pelo seed do banco (API) e pelo modo demonstração (MSW),
 * garantindo que os dois mostrem exatamente os mesmos dados.
 */
import { extractMentions } from '../mentions';
import type { Role } from '../permissions';
import { POSITION_STEP } from '../position';
import { DEMO_PASSWORD, demoUsers, demoWorkspaces } from './data';

export interface DUser {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarColor: string;
  /** Só existe no navegador do visitante (dados fictícios). */
  password: string;
  createdAt: string;
}
export interface DWorkspace {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}
export interface DMember {
  workspaceId: string;
  userId: string;
  role: Role;
  joinedAt: string;
}
export interface DBoard {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  color: string;
  archived: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface DColumn {
  id: string;
  boardId: string;
  title: string;
  position: number;
  wipLimit: number | null;
  isDone: boolean;
}
export interface DCard {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  position: number;
  dueDate: string | null;
  completedAt: string | null;
  archived: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeIds: string[];
  labelIds: string[];
}
export interface DLabel {
  id: string;
  boardId: string;
  name: string;
  color: string;
}
export interface DChecklistItem {
  id: string;
  checklistId: string;
  text: string;
  done: boolean;
  position: number;
}
export interface DChecklist {
  id: string;
  cardId: string;
  title: string;
  position: number;
  items: DChecklistItem[];
}
export interface DComment {
  id: string;
  cardId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
export interface DAttachment {
  id: string;
  cardId: string;
  uploaderId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  dataUrl: string;
}
export interface DActivity {
  id: string;
  workspaceId: string;
  boardId: string | null;
  cardId: string | null;
  actorId: string | null;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}
export interface DNotification {
  id: string;
  userId: string;
  actorId: string | null;
  type: 'MENTION' | 'ASSIGNED' | 'COMMENT' | 'MEMBER_ADDED';
  message: string;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export interface DemoDb {
  version: number;
  users: DUser[];
  workspaces: DWorkspace[];
  members: DMember[];
  boards: DBoard[];
  columns: DColumn[];
  cards: DCard[];
  labels: DLabel[];
  checklists: DChecklist[];
  comments: DComment[];
  attachments: DAttachment[];
  activities: DActivity[];
  notifications: DNotification[];
}

export const DEMO_DATASET_VERSION = 1;
const DAY = 24 * 60 * 60 * 1000;

let counter = 0;
export function newId(prefix = 'd') {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Monta o banco com datas relativas a "agora", como o seed da API. */
export function createDemoDb(now = Date.now()): DemoDb {
  const daysAgo = (days: number, hour = 10) => {
    const date = new Date(now - days * DAY);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const daysFromNow = (days: number) => {
    const date = new Date(now + days * DAY);
    date.setHours(18, 0, 0, 0);
    return date.toISOString();
  };

  const db: DemoDb = {
    version: DEMO_DATASET_VERSION,
    users: [],
    workspaces: [],
    members: [],
    boards: [],
    columns: [],
    cards: [],
    labels: [],
    checklists: [],
    comments: [],
    attachments: [],
    activities: [],
    notifications: [],
  };

  const userIds = new Map<string, string>();
  demoUsers.forEach((user, index) => {
    const id = `u-${user.key}`;
    userIds.set(user.key, id);
    const { key: _key, ...profile } = user;
    db.users.push({ ...profile, id, password: DEMO_PASSWORD, createdAt: daysAgo(60 - index) });
  });
  const uid = (key: string) => userIds.get(key)!;

  demoWorkspaces.forEach((ws, wsIndex) => {
    const workspaceId = `w-${wsIndex + 1}`;
    db.workspaces.push({
      id: workspaceId,
      name: ws.name,
      description: ws.description,
      createdAt: daysAgo(45),
    });
    for (const member of ws.members) {
      db.members.push({
        workspaceId,
        userId: uid(member.user),
        role: member.role,
        joinedAt: daysAgo(44),
      });
    }
    const owner = ws.members.find((member) => member.role === 'OWNER')!;
    db.activities.push({
      id: newId('a'),
      workspaceId,
      boardId: null,
      cardId: null,
      actorId: uid(owner.user),
      type: 'workspace.created',
      data: {},
      createdAt: daysAgo(45),
    });

    ws.boards.forEach((b, boardIndex) => {
      const boardId = `b-${wsIndex + 1}-${boardIndex + 1}`;
      db.boards.push({
        id: boardId,
        workspaceId,
        title: b.title,
        description: b.description,
        color: b.color,
        archived: false,
        createdById: uid(b.createdBy),
        createdAt: daysAgo(43),
        updatedAt: daysAgo(1),
      });
      db.activities.push({
        id: newId('a'),
        workspaceId,
        boardId,
        cardId: null,
        actorId: uid(b.createdBy),
        type: 'board.created',
        data: { boardTitle: b.title },
        createdAt: daysAgo(43),
      });
      const labelIds = new Map<string, string>();
      for (const label of b.labels) {
        const id = `${boardId}-l-${label.key}`;
        labelIds.set(label.key, id);
        db.labels.push({ id, boardId, name: label.name, color: label.color });
      }

      b.columns.forEach((col, columnIndex) => {
        const columnId = `${boardId}-c${columnIndex + 1}`;
        db.columns.push({
          id: columnId,
          boardId,
          title: col.title,
          position: (columnIndex + 1) * POSITION_STEP,
          wipLimit: col.wipLimit ?? null,
          isDone: col.isDone ?? false,
        });

        col.cards.forEach((c, cardIndex) => {
          const cardId = `${columnId}-k${cardIndex + 1}`;
          const createdAt = daysAgo(c.createdDaysAgo, 9);
          const completedAt =
            col.isDone && c.completedDaysAgo !== undefined ? daysAgo(c.completedDaysAgo, 16) : null;
          db.cards.push({
            id: cardId,
            boardId,
            columnId,
            title: c.title,
            description: c.description ?? '',
            position: (cardIndex + 1) * POSITION_STEP,
            dueDate: c.dueInDays !== undefined ? daysFromNow(c.dueInDays) : null,
            completedAt,
            archived: false,
            createdById: uid(c.createdBy),
            createdAt,
            updatedAt: completedAt ?? createdAt,
            assigneeIds: (c.assignees ?? []).map(uid),
            labelIds: (c.labels ?? []).map((key) => labelIds.get(key)!),
          });
          db.activities.push({
            id: newId('a'),
            workspaceId,
            boardId,
            cardId,
            actorId: uid(c.createdBy),
            type: 'card.created',
            data: { cardTitle: c.title, columnTitle: b.columns[0]!.title },
            createdAt,
          });
          if (columnIndex > 0) {
            db.activities.push({
              id: newId('a'),
              workspaceId,
              boardId,
              cardId,
              actorId: uid(c.assignees?.[0] ?? c.createdBy),
              type: completedAt ? 'card.completed' : 'card.moved',
              data: {
                cardTitle: c.title,
                fromColumn: b.columns[columnIndex - 1]!.title,
                toColumn: col.title,
              },
              createdAt: completedAt ?? new Date(new Date(createdAt).getTime() + DAY).toISOString(),
            });
          }
          (c.checklists ?? []).forEach((cl, checklistIndex) => {
            const checklistId = `${cardId}-cl${checklistIndex + 1}`;
            db.checklists.push({
              id: checklistId,
              cardId,
              title: cl.title,
              position: (checklistIndex + 1) * POSITION_STEP,
              items: cl.items.map(([text, done], itemIndex) => ({
                id: `${checklistId}-i${itemIndex + 1}`,
                checklistId,
                text,
                done,
                position: (itemIndex + 1) * POSITION_STEP,
              })),
            });
          });
          for (const cm of c.comments ?? []) {
            const commentAt = daysAgo(cm.daysAgo, 14);
            const commentId = newId('m');
            db.comments.push({
              id: commentId,
              cardId,
              authorId: uid(cm.author),
              body: cm.body,
              createdAt: commentAt,
              updatedAt: commentAt,
            });
            db.activities.push({
              id: newId('a'),
              workspaceId,
              boardId,
              cardId,
              actorId: uid(cm.author),
              type: 'comment.created',
              data: { cardTitle: c.title },
              createdAt: commentAt,
            });
            const author = db.users.find((user) => user.id === uid(cm.author))!;
            for (const username of extractMentions(cm.body)) {
              const mentioned = db.users.find((user) => user.username === username);
              if (!mentioned || mentioned.id === author.id) continue;
              db.notifications.push({
                id: newId('n'),
                userId: mentioned.id,
                actorId: author.id,
                type: 'MENTION',
                message: `${author.name} mencionou você em "${c.title}"`,
                data: { workspaceId, boardId, cardId, commentId },
                readAt: null,
                createdAt: commentAt,
              });
            }
          }
        });
      });
    });
  });

  // Algumas atribuições recentes para o usuário principal ter o que ver no sino.
  const arthur = uid('arthur');
  db.cards
    .filter(
      (card) =>
        card.assigneeIds.includes(arthur) && !card.completedAt && card.createdById !== arthur,
    )
    .slice(0, 2)
    .forEach((card) => {
      const actor = db.users.find((user) => user.id === card.createdById)!;
      const board = db.boards.find((entry) => entry.id === card.boardId)!;
      db.notifications.push({
        id: newId('n'),
        userId: arthur,
        actorId: actor.id,
        type: 'ASSIGNED',
        message: `${actor.name} atribuiu você ao cartão "${card.title}"`,
        data: { workspaceId: board.workspaceId, boardId: board.id, cardId: card.id },
        readAt: null,
        createdAt: daysAgo(2),
      });
    });

  return db;
}
