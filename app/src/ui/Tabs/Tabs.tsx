import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import s from './Tabs.module.css';

export interface TabDef {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  hint?: string;
}

/** Patrón WAI-ARIA de pestañas con flechas izquierda/derecha, Inicio y Fin. */
export function Tabs({
  tabs,
  value,
  onChange,
  idPrefix,
  label,
}: {
  tabs: TabDef[];
  value: string;
  onChange(id: string): void;
  idPrefix: string;
  label: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = tabs.filter((t) => !t.disabled);
  const onKey = (e: KeyboardEvent) => {
    const i = enabled.findIndex((t) => t.id === value);
    let next: TabDef | undefined;
    if (e.key === 'ArrowRight') next = enabled[(i + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(i - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (next) {
      e.preventDefault();
      onChange(next.id);
      refs.current[next.id]?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className={s.list} onKeyDown={onKey}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          role="tab"
          type="button"
          id={`${idPrefix}-tab-${t.id}`}
          aria-controls={`${idPrefix}-panel-${t.id}`}
          aria-selected={value === t.id}
          aria-disabled={t.disabled || undefined}
          tabIndex={value === t.id ? 0 : -1}
          className={s.tab}
          onClick={() => !t.disabled && onChange(t.id)}
        >
          <span>{t.label}</span>
          {t.disabled && t.hint && <span className={s.hint}>{t.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idPrefix, id, children }: { idPrefix: string; id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} className={s.panel}>
      {children}
    </div>
  );
}
