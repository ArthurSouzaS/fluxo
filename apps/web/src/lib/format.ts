const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const fullFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const relativeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatShortDate(iso: string) {
  return dateFormatter.format(new Date(iso)).replace('.', '');
}

export function formatFullDate(iso: string) {
  return fullFormatter.format(new Date(iso));
}

/** "há 5 minutos", "ontem", "em 3 dias"... */
export function formatRelative(iso: string, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return 'agora';
  if (abs < hour) return relativeFormatter.format(Math.round(diff / minute), 'minute');
  if (abs < day) return relativeFormatter.format(Math.round(diff / hour), 'hour');
  if (abs < 30 * day) return relativeFormatter.format(Math.round(diff / day), 'day');
  return formatShortDate(iso);
}

export type DueStatus = 'overdue' | 'soon' | 'later' | 'done';

/** Situação do prazo: atrasado, vence em até 48 h, mais tarde ou concluído. */
export function dueStatus(
  dueDate: string,
  completedAt: string | null,
  now = Date.now(),
): DueStatus {
  if (completedAt) return 'done';
  const due = new Date(dueDate).getTime();
  if (due < now) return 'overdue';
  if (due - now <= 48 * 60 * 60 * 1000) return 'soon';
  return 'later';
}

/** Converte ISO → valor de <input type="date"> (data local). */
export function toDateInput(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Converte <input type="date"> → ISO no fim do dia local (18h, horário comercial). */
export function fromDateInput(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!, 18, 0, 0).toISOString();
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}
