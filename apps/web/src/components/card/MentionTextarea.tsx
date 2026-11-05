'use client';

import {
  forwardRef,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Member } from '@fluxo/shared';
import { Avatar } from '../ui/Avatar';
import styles from './MentionTextarea.module.scss';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  members: Member[];
  placeholder?: string;
  label: string;
}

/** Retorna o termo após "@" imediatamente antes do cursor (ou null). */
export function mentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = /(^|[\s(])@([a-z0-9._-]{0,24})$/i.exec(before);
  if (!match) return null;
  return { query: match[2]!.toLowerCase(), start: caret - match[2]!.length - 1 };
}

/** Campo de comentário com autocompletar de menções (@apelido). */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea(
    { value, onChange, onSubmit, members, placeholder, label },
    forwardedRef,
  ) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwardedRef, () => ref.current!);
    const listId = useId();
    const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
    const [active, setActive] = useState(0);
    /** Posição do cursor a aplicar assim que o novo texto for renderizado. */
    const pendingCaret = useRef<number | null>(null);

    useLayoutEffect(() => {
      if (pendingCaret.current === null || !ref.current) return;
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }, [value]);

    const suggestions = useMemo(() => {
      if (!mention) return [];
      return members
        .filter(
          (member) =>
            member.user.username.includes(mention.query) ||
            member.user.name.toLowerCase().includes(mention.query),
        )
        .slice(0, 6);
    }, [mention, members]);

    const updateMention = (text: string, caret: number) => {
      setMention(mentionQuery(text, caret));
      setActive(0);
    };

    const insert = (member: Member) => {
      if (!mention || !ref.current) return;
      const caret = ref.current.selectionStart;
      const next = `${value.slice(0, mention.start)}@${member.user.username} ${value.slice(caret)}`;
      onChange(next);
      setMention(null);
      pendingCaret.current = mention.start + member.user.username.length + 2;
      ref.current.focus();
    };

    const open = suggestions.length > 0;

    return (
      <div className={styles.wrapper}>
        <textarea
          ref={ref}
          aria-label={label}
          className={styles.textarea}
          value={value}
          placeholder={placeholder}
          maxLength={5000}
          rows={3}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            updateMention(event.target.value, event.target.selectionStart);
          }}
          onClick={(event) => updateMention(value, event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            if (open) {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                setActive((index) => (index + delta + suggestions.length) % suggestions.length);
                return;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insert(suggestions[active]!);
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setMention(null);
                return;
              }
            }
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label="Pessoas para mencionar"
            className={styles.list}
          >
            {suggestions.map((member, index) => (
              <li
                key={member.userId}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={styles.option}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(member);
                }}
              >
                <Avatar user={member.user} size={22} labelled={false} />
                <span>{member.user.name}</span>
                <span className={styles.username}>@{member.user.username}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
