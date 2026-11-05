'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '../ui/Button';
import styles from './InlineComposer.module.scss';

interface InlineComposerProps {
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  /** Mantém aberto após enviar (para criar vários seguidos). */
  keepOpen?: boolean;
  maxLength?: number;
  label: string;
}

/** Campo rápido para criar cartões/colunas: Enter envia, Esc cancela. */
export function InlineComposer({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  keepOpen,
  maxLength = 200,
  label,
}: InlineComposerProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => ref.current?.focus(), []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    if (keepOpen) ref.current?.focus();
    else onCancel();
  };

  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={ref}
        aria-label={label}
        className={styles.input}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={2}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" size="sm" disabled={!value.trim()}>
          {submitLabel}
        </Button>
        <IconButton icon="x" label="Cancelar" size="sm" onClick={onCancel} />
      </div>
    </form>
  );
}
