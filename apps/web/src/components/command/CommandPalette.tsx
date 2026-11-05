'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { Icon, type IconName } from '../ui/Icon';
import { Spinner } from '../ui/Spinner';
import styles from './CommandPalette.module.scss';

interface Option {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: IconName;
  color?: string;
  run: () => void;
}

/** Busca global (Ctrl+K): quadros, cartões e comandos rápidos. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query.trim(), 200);

  const search = useQuery({
    queryKey: queryKeys.search(debounced),
    queryFn: ({ signal }) => searchApi.search(debounced, signal),
    enabled: open && debounced.length >= 2,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => previous?.focus?.();
  }, [open]);

  const options = useMemo<Option[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const commands: Option[] = [
      {
        id: 'cmd-home',
        group: 'Comandos',
        label: 'Ir para meus workspaces',
        icon: 'home',
        run: go('/app'),
      },
      {
        id: 'cmd-profile',
        group: 'Comandos',
        label: 'Perfil e senha',
        icon: 'settings',
        run: go('/settings'),
      },
      {
        id: 'cmd-theme',
        group: 'Comandos',
        label: theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro',
        icon: theme === 'dark' ? 'sun' : 'moon',
        run: () => {
          toggleTheme();
          onClose();
        },
      },
    ];
    const q = query.trim().toLowerCase();
    const filteredCommands = commands.filter(
      (command) => !q || command.label.toLowerCase().includes(q),
    );
    if (debounced.length < 2 || !search.data) return filteredCommands;
    return [
      ...search.data.boards.map((board) => ({
        id: `board-${board.id}`,
        group: 'Quadros',
        label: board.title,
        hint: board.workspaceName,
        icon: 'board' as const,
        color: board.color,
        run: go(`/board?id=${board.id}`),
      })),
      ...search.data.cards.map((card) => ({
        id: `card-${card.id}`,
        group: 'Cartões',
        label: card.title,
        hint: `${card.boardTitle} · ${card.columnTitle}`,
        icon: card.completedAt ? ('check' as const) : ('text' as const),
        run: go(`/board?id=${card.boardId}&card=${card.id}`),
      })),
      ...filteredCommands,
    ];
  }, [debounced, search.data, query, theme, toggleTheme, router, onClose]);

  useEffect(() => setActive(0), [options.length]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % Math.max(options.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + options.length) % Math.max(options.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      options[active]?.run();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      event.preventDefault();
    }
  };

  const groups = [...new Set(options.map((option) => option.group))];
  const searching = debounced.length >= 2 && search.isFetching;
  const empty =
    debounced.length >= 2 &&
    !search.isFetching &&
    options.every((option) => option.group === 'Comandos');

  return createPortal(
    <div
      role="presentation"
      className={styles.overlay}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Busca global">
        <div className={styles.inputRow}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar quadros, cartões ou comandos..."
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${options[active].id}` : undefined}
            aria-autocomplete="list"
          />
          {searching ? <Spinner size={16} label="Buscando" /> : <kbd>Esc</kbd>}
        </div>
        <div id={listId} role="listbox" aria-label="Resultados" className={styles.list}>
          {empty ? <p className={styles.empty}>Nenhum resultado para “{debounced}”.</p> : null}
          {groups.map((group) => (
            <div key={group} role="group" aria-label={group}>
              <div className={styles.group}>{group}</div>
              {options
                .filter((option) => option.group === group)
                .map((option) => {
                  const index = options.indexOf(option);
                  return (
                    // Padrão combobox: o foco fica no campo e as setas movem a opção ativa.
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                    <div
                      key={option.id}
                      tabIndex={-1}
                      id={`${listId}-${option.id}`}
                      role="option"
                      aria-selected={index === active}
                      className={styles.option}
                      onMouseEnter={() => setActive(index)}
                      onClick={option.run}
                    >
                      <span
                        className={styles.optionIcon}
                        style={option.color ? { color: option.color } : undefined}
                      >
                        <Icon name={option.icon} size={16} />
                      </span>
                      <span className={styles.optionLabel}>{option.label}</span>
                      {option.hint ? (
                        <span className={styles.optionHint}>{option.hint}</span>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
        <footer className={styles.footer}>
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navegar
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
