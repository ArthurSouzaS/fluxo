/** Paletas e modelos usados pela API, pela web e pelo modo demonstração. */
import type { BoardTemplate } from './schemas';

export const AVATAR_COLORS = [
  '#34d399',
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#fb7185',
  '#2dd4bf',
  '#94a3b8',
] as const;

export const BOARD_COLORS = [
  '#34d399',
  '#38bdf8',
  '#a78bfa',
  '#fbbf24',
  '#f472b6',
  '#fb7185',
  '#2dd4bf',
  '#94a3b8',
] as const;

export const LABEL_COLORS = [
  '#f87171',
  '#fb923c',
  '#fbbf24',
  '#34d399',
  '#2dd4bf',
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#94a3b8',
] as const;

/** Etiquetas criadas junto com quadros dos modelos Kanban e Sprint. */
export const DEFAULT_LABELS = [
  { name: 'Bug', color: '#f87171' },
  { name: 'Melhoria', color: '#34d399' },
  { name: 'Urgente', color: '#fb923c' },
  { name: 'Documentação', color: '#38bdf8' },
] as const;

/** Colunas iniciais de cada modelo de quadro. */
export const TEMPLATE_COLUMNS: Record<
  BoardTemplate,
  ReadonlyArray<{ title: string; isDone?: boolean }>
> = {
  kanban: [{ title: 'A fazer' }, { title: 'Em andamento' }, { title: 'Concluído', isDone: true }],
  scrum: [
    { title: 'Backlog' },
    { title: 'A fazer' },
    { title: 'Em andamento' },
    { title: 'Em revisão' },
    { title: 'Concluído', isDone: true },
  ],
  blank: [],
};

export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}
