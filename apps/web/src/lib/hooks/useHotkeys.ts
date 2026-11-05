'use client';

import { useEffect, useRef } from 'react';

export interface Hotkey {
  /** Ex.: "mod+k", "?", "n", "escape". "mod" = Ctrl (Windows/Linux) ou ⌘ (Mac). */
  combo: string;
  handler: (event: KeyboardEvent) => void;
  /** Dispara mesmo com foco em campos de texto. */
  allowInInputs?: boolean;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.getAttribute('role') === 'textbox'
  );
}

export function matchesCombo(event: KeyboardEvent, combo: string) {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop();
  const wantsMod = parts.includes('mod');
  const mod = event.ctrlKey || event.metaKey;
  if (wantsMod !== mod) return false;
  if (parts.includes('shift') && !event.shiftKey) return false;
  return event.key.toLowerCase() === key;
}

/** Atalhos de teclado globais. */
export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      for (const hotkey of ref.current) {
        if (!matchesCombo(event, hotkey.combo)) continue;
        if (!hotkey.allowInInputs && isTypingTarget(event.target)) continue;
        hotkey.handler(event);
        break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
