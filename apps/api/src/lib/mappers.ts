/**
 * Conversão dos registros do Prisma para os formatos públicos da API
 * (tipos definidos em @fluxo/shared). Centralizar aqui evita vazar campos
 * sensíveis (ex.: passwordHash) e mantém as respostas consistentes.
 */
import type { Prisma } from '@prisma/client';
import type {
  Activity,
  Attachment,
  CardSummary,
  Column,
  Comment,
  Label,
  Member,
  Notification,
  NotificationKind,
  Role,
  UserProfile,
  UserPublic,
} from '@fluxo/shared';

export const userPublicSelect = {
  id: true,
  name: true,
  username: true,
  avatarColor: true,
} satisfies Prisma.UserSelect;

export const userProfileSelect = {
  ...userPublicSelect,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type UserPublicRow = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;
type UserProfileRow = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;

export const toUserPublic = (user: UserPublicRow): UserPublic => ({
  id: user.id,
  name: user.name,
  username: user.username,
  avatarColor: user.avatarColor,
});

export const toUserProfile = (user: UserProfileRow): UserProfile => ({
  ...toUserPublic(user),
  email: user.email,
  createdAt: user.createdAt.toISOString(),
});

export const iso = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;

// ---------------------------------------------------------------------------

export const memberInclude = {
  user: { select: { ...userPublicSelect, email: true } },
} satisfies Prisma.WorkspaceMemberInclude;

type MemberRow = Prisma.WorkspaceMemberGetPayload<{ include: typeof memberInclude }>;

export const toMember = (member: MemberRow): Member => ({
  userId: member.userId,
  role: member.role as Role,
  joinedAt: member.joinedAt.toISOString(),
  user: { ...toUserPublic(member.user), email: member.user.email },
});

// ---------------------------------------------------------------------------

type ColumnRow = Prisma.BoardColumnGetPayload<object>;

export const toColumn = (column: ColumnRow): Column => ({
  id: column.id,
  boardId: column.boardId,
  title: column.title,
  position: column.position,
  wipLimit: column.wipLimit,
  isDone: column.isDone,
});

type LabelRow = Prisma.LabelGetPayload<object>;

export const toLabel = (label: LabelRow): Label => ({
  id: label.id,
  boardId: label.boardId,
  name: label.name,
  color: label.color,
});

// ---------------------------------------------------------------------------

export const cardSummaryInclude = {
  labels: { select: { labelId: true } },
  assignees: { select: { userId: true }, orderBy: { assignedAt: 'asc' } },
  checklists: { select: { items: { select: { done: true } } } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.CardInclude;

export type CardSummaryRow = Prisma.CardGetPayload<{ include: typeof cardSummaryInclude }>;

export function toCardSummary(card: CardSummaryRow): CardSummary {
  const items = card.checklists.flatMap((checklist) => checklist.items);
  return {
    id: card.id,
    boardId: card.boardId,
    columnId: card.columnId,
    title: card.title,
    position: card.position,
    dueDate: iso(card.dueDate),
    completedAt: iso(card.completedAt),
    archived: card.archived,
    hasDescription: card.description.trim().length > 0,
    labelIds: card.labels.map((label) => label.labelId),
    assigneeIds: card.assignees.map((assignee) => assignee.userId),
    commentCount: card._count.comments,
    attachmentCount: card._count.attachments,
    checklist: { done: items.filter((item) => item.done).length, total: items.length },
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------

export const commentInclude = {
  author: { select: userPublicSelect },
} satisfies Prisma.CommentInclude;

type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export const toComment = (comment: CommentRow): Comment => ({
  id: comment.id,
  cardId: comment.cardId,
  body: comment.body,
  author: toUserPublic(comment.author),
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString(),
});

export const attachmentInclude = {
  uploader: { select: userPublicSelect },
} satisfies Prisma.AttachmentInclude;

type AttachmentRow = Prisma.AttachmentGetPayload<{ include: typeof attachmentInclude }>;

export const toAttachment = (attachment: AttachmentRow): Attachment => ({
  id: attachment.id,
  cardId: attachment.cardId,
  fileName: attachment.fileName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  uploader: attachment.uploader ? toUserPublic(attachment.uploader) : null,
  createdAt: attachment.createdAt.toISOString(),
});

export const activityInclude = {
  actor: { select: userPublicSelect },
} satisfies Prisma.ActivityInclude;

type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

export const toActivity = (activity: ActivityRow): Activity => ({
  id: activity.id,
  type: activity.type,
  data: (activity.data ?? {}) as Record<string, unknown>,
  boardId: activity.boardId,
  cardId: activity.cardId,
  actor: activity.actor ? toUserPublic(activity.actor) : null,
  createdAt: activity.createdAt.toISOString(),
});

export const notificationInclude = {
  actor: { select: userPublicSelect },
} satisfies Prisma.NotificationInclude;

type NotificationRow = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

export const toNotification = (notification: NotificationRow): Notification => ({
  id: notification.id,
  type: notification.type as NotificationKind,
  message: notification.message,
  data: (notification.data ?? {}) as Notification['data'],
  actor: notification.actor ? toUserPublic(notification.actor) : null,
  readAt: iso(notification.readAt),
  createdAt: notification.createdAt.toISOString(),
});
