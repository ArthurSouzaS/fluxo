'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './Popover.module.scss';

interface PopoverProps {
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-controls': string;
    ref: React.Ref<HTMLButtonElement>;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  label: string;
  align?: 'start' | 'end';
}

/** Painel flutuante simples (fecha com Esc ou clique fora, devolve o foco). */
export function Popover({ trigger, children, label, align = 'start' }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = document.getElementById(id);
    panel?.querySelector<HTMLElement>('input, button, [tabindex]')?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, id]);

  return (
    <div className={styles.root} ref={rootRef}>
      {trigger({
        onClick: () => setOpen((value) => !value),
        'aria-expanded': open,
        'aria-controls': id,
        ref: triggerRef,
      })}
      {open ? (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={[styles.panel, styles[align]].join(' ')}
        >
          {children(() => {
            setOpen(false);
            triggerRef.current?.focus();
          })}
        </div>
      ) : null}
    </div>
  );
}
