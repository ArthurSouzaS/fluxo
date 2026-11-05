/**
 * Funções tipadas para cada rota da API.
 */
import type {
  Activity,
  AddMemberInput,
  Attachment,
  AuthResponse,
  BoardDetail,
  BoardStats,
  BoardSummary,
  CardDetail,
  CardSummary,
  ChangePasswordInput,
  Checklist,
  Column,
  Comment,
  CreateBoardInput,
  CreateCardInput,
  CreateColumnInput,
  CreateLabelInput,
  CreateWorkspaceInput,
  Label,
  LoginInput,
  Member,
  Notification,
  NotificationList,
  Paginated,
  RegisterInput,
  Role,
  SearchResults,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateColumnInput,
  UpdateLabelInput,
  UpdateProfileInput,
  UpdateWorkspaceInput,
  UserProfile,
  WorkspaceSummary,
} from '@fluxo/shared';
import { request } from './client';

export const authApi = {
  login: (input: LoginInput) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  changePassword: (input: ChangePasswordInput) =>
    request<AuthResponse>('/auth/change-password', { method: 'POST', body: input }),
  updateProfile: (input: UpdateProfileInput) =>
    request<UserProfile>('/users/me', { method: 'PATCH', body: input }),
};

export const workspacesApi = {
  list: () => request<WorkspaceSummary[]>('/workspaces'),
  get: (id: string) => request<WorkspaceSummary>(`/workspaces/${id}`),
  create: (input: CreateWorkspaceInput) =>
    request<WorkspaceSummary>('/workspaces', { method: 'POST', body: input }),
  update: (id: string, input: UpdateWorkspaceInput) =>
    request<WorkspaceSummary>(`/workspaces/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<void>(`/workspaces/${id}`, { method: 'DELETE' }),
  members: (id: string) => request<Member[]>(`/workspaces/${id}/members`),
  addMember: (id: string, input: AddMemberInput) =>
    request<Member>(`/workspaces/${id}/members`, { method: 'POST', body: input }),
  updateMember: (id: string, userId: string, role: Role) =>
    request<Member>(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeMember: (id: string, userId: string) =>
    request<void>(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
};

export const boardsApi = {
  list: (workspaceId: string, archived = false) =>
    request<BoardSummary[]>(`/workspaces/${workspaceId}/boards`, { query: { archived } }),
  create: (workspaceId: string, input: CreateBoardInput) =>
    request<BoardDetail>(`/workspaces/${workspaceId}/boards`, { method: 'POST', body: input }),
  get: (id: string) => request<BoardDetail>(`/boards/${id}`),
  update: (id: string, input: UpdateBoardInput) =>
    request<BoardDetail>(`/boards/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<void>(`/boards/${id}`, { method: 'DELETE' }),
  stats: (id: string) => request<BoardStats>(`/boards/${id}/stats`),
  activities: (id: string, page = 1) =>
    request<Paginated<Activity>>(`/boards/${id}/activities`, { query: { page, pageSize: 30 } }),
};

export const columnsApi = {
  create: (boardId: string, input: CreateColumnInput) =>
    request<Column>(`/boards/${boardId}/columns`, { method: 'POST', body: input }),
  update: (id: string, input: UpdateColumnInput) =>
    request<Column>(`/columns/${id}`, { method: 'PATCH', body: input }),
  move: (id: string, index: number) =>
    request<Column>(`/columns/${id}/move`, { method: 'POST', body: { index } }),
  remove: (id: string) => request<void>(`/columns/${id}`, { method: 'DELETE' }),
};

export const cardsApi = {
  create: (columnId: string, input: CreateCardInput) =>
    request<CardSummary>(`/columns/${columnId}/cards`, { method: 'POST', body: input }),
  get: (id: string) => request<CardDetail>(`/cards/${id}`),
  update: (id: string, input: UpdateCardInput) =>
    request<CardSummary>(`/cards/${id}`, { method: 'PATCH', body: input }),
  move: (id: string, columnId: string, index: number) =>
    request<CardSummary>(`/cards/${id}/move`, { method: 'POST', body: { columnId, index } }),
  remove: (id: string) => request<void>(`/cards/${id}`, { method: 'DELETE' }),
  setAssignees: (id: string, userIds: string[]) =>
    request<CardSummary>(`/cards/${id}/assignees`, { method: 'PUT', body: { userIds } }),
  setLabels: (id: string, labelIds: string[]) =>
    request<CardSummary>(`/cards/${id}/labels`, { method: 'PUT', body: { labelIds } }),
  activities: (id: string, page = 1) =>
    request<Paginated<Activity>>(`/cards/${id}/activities`, { query: { page, pageSize: 20 } }),
  comments: (id: string, page = 1) =>
    request<Paginated<Comment>>(`/cards/${id}/comments`, { query: { page, pageSize: 20 } }),
  addComment: (id: string, body: string) =>
    request<Comment>(`/cards/${id}/comments`, { method: 'POST', body: { body } }),
  addChecklist: (id: string, title: string) =>
    request<Checklist>(`/cards/${id}/checklists`, { method: 'POST', body: { title } }),
  upload: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Attachment>(`/cards/${id}/attachments`, { method: 'POST', body: form });
  },
};

export const commentsApi = {
  update: (id: string, body: string) =>
    request<Comment>(`/comments/${id}`, { method: 'PATCH', body: { body } }),
  remove: (id: string) => request<void>(`/comments/${id}`, { method: 'DELETE' }),
};

export const checklistsApi = {
  rename: (id: string, title: string) =>
    request<Checklist>(`/checklists/${id}`, { method: 'PATCH', body: { title } }),
  remove: (id: string) => request<void>(`/checklists/${id}`, { method: 'DELETE' }),
  addItem: (id: string, text: string) =>
    request<Checklist>(`/checklists/${id}/items`, { method: 'POST', body: { text } }),
  updateItem: (itemId: string, input: { text?: string; done?: boolean }) =>
    request<Checklist>(`/checklist-items/${itemId}`, { method: 'PATCH', body: input }),
  removeItem: (itemId: string) =>
    request<Checklist>(`/checklist-items/${itemId}`, { method: 'DELETE' }),
};

export const labelsApi = {
  create: (boardId: string, input: CreateLabelInput) =>
    request<Label>(`/boards/${boardId}/labels`, { method: 'POST', body: input }),
  update: (id: string, input: UpdateLabelInput) =>
    request<Label>(`/labels/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => request<void>(`/labels/${id}`, { method: 'DELETE' }),
};

export const attachmentsApi = {
  download: (id: string) => request<Response>(`/attachments/${id}/download`, { raw: true }),
  remove: (id: string) => request<void>(`/attachments/${id}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: (page = 1) =>
    request<NotificationList>('/notifications', { query: { page, pageSize: 20 } }),
  markRead: (id: string) => request<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
};

export const searchApi = {
  search: (q: string, signal?: AbortSignal) =>
    request<SearchResults>('/search', { query: { q }, signal }),
};
