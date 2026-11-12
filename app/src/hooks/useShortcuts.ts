import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  /** índice 0-based por número o letra */
  option?(index: number): void;
  enter?(): void;
  prev?(): void;
  next?(): void;
  retry?(): void;
  favorite?(): void;
  flag?(): void;
  fragment?(): void;
  navigator?(): void;
  help?(): void;
}

export interface ShortcutOptions {
  enabled: boolean;
  singleKey: boolean; // atajos de una tecla (letras, números, ?)
  optionLetters: string[]; // letras existentes en la pregunta
}

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['radio', 'checkbox', 'button', 'submit'].includes(el.type);
  return (el as HTMLElement).isContentEditable === true;
}

export function shortcutsBlocked(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return true;
  if (document.querySelector('dialog[open]')) return true;
  if (isTextField(e.target as Element)) return true;
  return false;
}

const LETTER_ACTIONS: Record<string, keyof ShortcutHandlers> = {
  p: 'prev',
  n: 'next',
  r: 'retry',
  f: 'favorite',
  m: 'flag',
  v: 'fragment',
  g: 'navigator',
};

/** Atajos de teclado de PLAN 5.4. Los handlers se leen por ref (no hace falta memoizarlos). */
export function useShortcuts(handlers: ShortcutHandlers, opts: ShortcutOptions) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = optsRef.current;
      const h = ref.current;
      if (!o.enabled || e.defaultPrevented || shortcutsBlocked(e)) return;
      const target = e.target as HTMLElement | null;
      const onControl = !!target?.closest('button, a[href], summary, [role="tab"]');
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (target?.closest('[role="tablist"], pre, [data-zoom-viewer]')) return;
        e.preventDefault();
        (e.key === 'ArrowLeft' ? h.prev : h.next)?.();
        return;
      }
      if (e.key === 'Enter') {
        if (onControl) return;
        if (h.enter) {
          e.preventDefault();
          h.enter();
        }
        return;
      }
      if (!o.singleKey) return;
      if (e.key === '?') {
        e.preventDefault();
        h.help?.();
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < o.optionLetters.length) {
          e.preventDefault();
          h.option?.(i);
        }
        return;
      }
      if (e.key.length !== 1) return;
      const upper = e.key.toUpperCase();
      const li = o.optionLetters.indexOf(upper);
      if (li >= 0) {
        e.preventDefault();
        h.option?.(li);
        return;
      }
      const action = LETTER_ACTIONS[e.key.toLowerCase()];
      if (action && h[action]) {
        e.preventDefault();
        (h[action] as () => void)();
      }
    };
    // captura: interceptar ←/→ antes de que el grupo de radios cambie la selección
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}
