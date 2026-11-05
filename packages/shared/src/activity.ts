/** Tipos de atividade registrados no histórico. */
export const ACTIVITY_TYPES = [
  'workspace.created',
  'workspace.updated',
  'member.added',
  'member.role_changed',
  'member.removed',
  'board.created',
  'board.updated',
  'column.created',
  'column.updated',
  'column.deleted',
  'card.created',
  'card.updated',
  'card.moved',
  'card.completed',
  'card.archived',
  'card.deleted',
  'card.assigned',
  'card.unassigned',
  'card.labeled',
  'card.due_changed',
  'checklist.created',
  'checklist.item_completed',
  'comment.created',
  'attachment.added',
  'attachment.removed',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityData {
  cardTitle?: string;
  boardTitle?: string;
  columnTitle?: string;
  fromColumn?: string;
  toColumn?: string;
  userName?: string;
  role?: string;
  fileName?: string;
  itemText?: string;
  checklistTitle?: string;
  dueDate?: string | null;
  fields?: string[];
  labelNames?: string[];
}

/** Monta a frase exibida no histórico (sem o nome de quem fez a ação). */
export function describeActivity(type: string, data: ActivityData): string {
  const card = data.cardTitle ? `"${data.cardTitle}"` : 'um cartão';
  switch (type) {
    case 'workspace.created':
      return 'criou o workspace';
    case 'workspace.updated':
      return 'atualizou o workspace';
    case 'member.added':
      return `adicionou ${data.userName ?? 'um membro'} ao workspace`;
    case 'member.role_changed':
      return `alterou o papel de ${data.userName ?? 'um membro'} para ${data.role ?? '?'}`;
    case 'member.removed':
      return `removeu ${data.userName ?? 'um membro'} do workspace`;
    case 'board.created':
      return `criou o quadro "${data.boardTitle ?? ''}"`;
    case 'board.updated':
      return 'atualizou o quadro';
    case 'column.created':
      return `criou a coluna "${data.columnTitle ?? ''}"`;
    case 'column.updated':
      return `atualizou a coluna "${data.columnTitle ?? ''}"`;
    case 'column.deleted':
      return `excluiu a coluna "${data.columnTitle ?? ''}"`;
    case 'card.created':
      return `criou o cartão ${card} em ${data.columnTitle ?? 'uma coluna'}`;
    case 'card.updated':
      return `editou o cartão ${card}`;
    case 'card.moved':
      return `moveu ${card} de ${data.fromColumn ?? '?'} para ${data.toColumn ?? '?'}`;
    case 'card.completed':
      return `concluiu o cartão ${card}`;
    case 'card.archived':
      return `arquivou o cartão ${card}`;
    case 'card.deleted':
      return `excluiu o cartão ${card}`;
    case 'card.assigned':
      return `atribuiu ${data.userName ?? 'alguém'} ao cartão ${card}`;
    case 'card.unassigned':
      return `removeu ${data.userName ?? 'alguém'} do cartão ${card}`;
    case 'card.labeled':
      return `alterou as etiquetas de ${card}`;
    case 'card.due_changed':
      return data.dueDate ? `alterou o prazo de ${card}` : `removeu o prazo de ${card}`;
    case 'checklist.created':
      return `adicionou o checklist "${data.checklistTitle ?? ''}" em ${card}`;
    case 'checklist.item_completed':
      return `concluiu "${data.itemText ?? ''}" em ${card}`;
    case 'comment.created':
      return `comentou em ${card}`;
    case 'attachment.added':
      return `anexou "${data.fileName ?? ''}" em ${card}`;
    case 'attachment.removed':
      return `removeu o anexo "${data.fileName ?? ''}" de ${card}`;
    default:
      return 'fez uma alteração';
  }
}
