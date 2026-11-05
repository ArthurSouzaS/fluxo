'use client';

import { forwardRef } from 'react';
import type { Label, Member } from '@fluxo/shared';
import { emptyFilters, hasActiveFilters, type BoardFilters } from '@/lib/board-state';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './FilterBar.module.scss';

interface FilterBarProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  labels: Label[];
  members: Member[];
  currentUserId: string;
  resultCount: number;
}

const DUE_OPTIONS: Array<{ value: BoardFilters['due']; label: string }> = [
  { value: '', label: 'Qualquer prazo' },
  { value: 'overdue', label: 'Atrasados' },
  { value: 'week', label: 'Próximos 7 dias' },
  { value: 'none', label: 'Sem prazo' },
];

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(function FilterBar(
  { filters, onChange, labels, members, currentUserId, resultCount },
  searchRef,
) {
  const active = hasActiveFilters(filters);
  const onlyMine = filters.assigneeIds.length === 1 && filters.assigneeIds[0] === currentUserId;
  return (
    <div className={styles.bar} role="search" aria-label="Filtrar cartões">
      <label className={styles.search}>
        <Icon name="search" size={14} />
        <span className="visually-hidden">Buscar cartões neste quadro</span>
        <input
          ref={searchRef}
          type="search"
          placeholder="Filtrar cartões..."
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </label>

      <Button
        size="sm"
        variant={onlyMine ? 'secondary' : 'ghost'}
        icon="user"
        aria-pressed={onlyMine}
        onClick={() => onChange({ ...filters, assigneeIds: onlyMine ? [] : [currentUserId] })}
      >
        Meus cartões
      </Button>

      <select
        className={styles.select}
        aria-label="Filtrar por prazo"
        value={filters.due}
        onChange={(event) =>
          onChange({ ...filters, due: event.target.value as BoardFilters['due'] })
        }
      >
        {DUE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {labels.length ? (
        <div className={styles.group} role="group" aria-label="Filtrar por etiqueta">
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              aria-pressed={filters.labelIds.includes(label.id)}
              className={styles.chip}
              style={{ ['--label' as string]: label.color }}
              onClick={() => onChange({ ...filters, labelIds: toggle(filters.labelIds, label.id) })}
            >
              <span className={styles.dot} aria-hidden />
              {label.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.group} role="group" aria-label="Filtrar por responsável">
        {members.map((member) => (
          <button
            key={member.userId}
            type="button"
            aria-pressed={filters.assigneeIds.includes(member.userId)}
            className={styles.person}
            title={member.user.name}
            onClick={() =>
              onChange({ ...filters, assigneeIds: toggle(filters.assigneeIds, member.userId) })
            }
          >
            <Avatar user={member.user} size={24} labelled={false} />
            <span className="visually-hidden">{member.user.name}</span>
          </button>
        ))}
      </div>

      {active ? (
        <div className={styles.summary}>
          <span aria-live="polite">
            {resultCount} {resultCount === 1 ? 'cartão' : 'cartões'}
          </span>
          <Button size="sm" variant="ghost" icon="x" onClick={() => onChange(emptyFilters)}>
            Limpar
          </Button>
        </div>
      ) : null}
    </div>
  );
});
