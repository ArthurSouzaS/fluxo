'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import styles from './Modal.module.scss';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Pilha de modais abertos: Esc e Tab só agem no modal do topo. */
const stack: string[] = [];

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Esconde o título visualmente (continua acessível). */
  hideTitle?: boolean;
  description?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: ReactNode;
  footer?: ReactNode;
  /** Seletor do elemento que recebe o foco ao abrir. */
  initialFocus?: string;
}

export function Modal({
  open,
  onClose,
  title,
  hideTitle,
  description,
  size = 'md',
  children,
  footer,
  initialFocus,
}: ModalProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(id);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const target =
      (initialFocus && panel?.querySelector<HTMLElement>(initialFocus)) ||
      panel?.querySelector<HTMLElement>('[data-autofocus]') ||
      panel;
    target?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack.at(-1) !== id || !panel) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      stack.splice(stack.indexOf(id), 1);
      if (stack.length === 0) document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open, id, initialFocus]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="presentation"
      className={styles.overlay}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        tabIndex={-1}
        className={[styles.panel, styles[size]].join(' ')}
      >
        <header className={styles.header}>
          <div className={styles.titles}>
            <h2 id={`${id}-title`} className={hideTitle ? 'visually-hidden' : styles.title}>
              {title}
            </h2>
            {description ? (
              <p id={`${id}-description`} className={styles.description}>
                {description}
              </p>
            ) : null}
          </div>
          <IconButton icon="x" label="Fechar" onClick={onClose} className={styles.close} />
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
