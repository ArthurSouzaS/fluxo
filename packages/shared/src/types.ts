/**
 * Formatos das respostas da API (datas sempre em ISO 8601).
 */
import type { Role } from './permissions';

export interface UserPublic {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
}

export interface UserProfile extends UserPublic {
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string | null;
  role: Role;
  memberCount: number;
  boardCount: number;
  createdAt: string;
}

export interface Member {
  userId: string;
  role: Role;
  joinedAt: string;
  user: UserPublic & { email: string };
}

export interface BoardSummary {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  color: string;
  archived: boolean;
  cardCount: number;
  updatedAt: string;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  position: number;
  wipLimit: number | null;
  isDone: boolean;
}

export interface CardSummary {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  position: number;
  dueDate: string | null;
  completedAt: string | null;
  archived: boolean;
  hasDescription: boolean;
  labelIds: string[];
  assigneeIds: string[];
  commentCount: number;
  attachmentCount: number;
  checklist: { done: number; total: number };
  createdAt: string;
  updatedAt: string;
}

export interface BoardDetail {
  id: string;
  workspaceId: string;
  workspaceName: string;
  title: string;
  description: string | null;
  color: string;
  archived: boolean;
  myRole: Role;
  columns: Column[];
  cards: CardSummary[];
  labels: Label[];
  members: Member[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  text: string;
  done: boolean;
  position: number;
}

export interface Checklist {
  id: string;
  cardId: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface Comment {
  id: string;
  cardId: string;
  body: string;
  author: UserPublic;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  cardId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploader: UserPublic | null;
  createdAt: string;
}

export interface CardDetail extends CardSummary {
  description: string;
  workspaceId: string;
  columnTitle: string;
  createdBy: UserPublic | null;
  assignees: UserPublic[];
  labels: Label[];
  checklists: Checklist[];
  attachments: Attachment[];
}

export interface Activity {
  id: string;
  type: string;
  data: Record<string, unknown>;
  boardId: string | null;
  cardId: string | null;
  actor: UserPublic | null;
  createdAt: string;
}

export type NotificationKind = 'MENTION' | 'ASSIGNED' | 'COMMENT' | 'MEMBER_ADDED';

export interface Notification {
  id: string;
  type: NotificationKind;
  message: string;
  data: { workspaceId?: string; boardId?: string; cardId?: string; commentId?: string };
  actor: UserPublic | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList extends Paginated<Notification> {
  unreadCount: number;
}

export interface SearchResults {
  boards: Array<{ id: string; title: string; color: string; workspaceName: string }>;
  cards: Array<{
    id: string;
    title: string;
    boardId: string;
    boardTitle: string;
    columnTitle: string;
    completedAt: string | null;
  }>;
}

export interface BoardStats {
  totals: { open: number; done: number; overdue: number; dueThisWeek: number; total: number };
  byColumn: Array<{ columnId: string; title: string; count: number; isDone: boolean }>;
  byAssignee: Array<{
    userId: string | null;
    name: string;
    avatarColor: string;
    open: number;
    done: number;
  }>;
  byLabel: Array<{ labelId: string; name: string; color: string; count: number }>;
  overdue: Array<{
    id: string;
    title: string;
    dueDate: string;
    columnTitle: string;
    assignees: string[];
  }>;
  completedPerWeek: Array<{ weekStart: string; count: number }>;
}
