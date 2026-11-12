import { Monitor, Moon, Sun } from 'lucide-react';
import { es } from '../../i18n/es';
import { IconButton } from '../Button/Button';

export type ThemeValue = 'system' | 'light' | 'dark';

/** Botón que alterna claro ↔ oscuro; muestra el icono del tema de destino. */
export function ThemeToggleButton({ resolved, onToggle, showLabel }: { resolved: 'light' | 'dark'; onToggle(): void; showLabel?: boolean }) {
  const toDark = resolved === 'light';
  return (
    <IconButton label={toDark ? es.theme.toDark : es.theme.toLight} onClick={onToggle} showLabel={showLabel}>
      {toDark ? <Moon size={20} strokeWidth={1.75} aria-hidden="true" /> : <Sun size={20} strokeWidth={1.75} aria-hidden="true" />}
    </IconButton>
  );
}

/** Grupo de radios para Ajustes. */
export function ThemeRadios({ value, onChange }: { value: ThemeValue; onChange(v: ThemeValue): void }) {
  const opts: { v: ThemeValue; label: string; Icon: typeof Sun }[] = [
    { v: 'system', label: es.theme.system, Icon: Monitor },
    { v: 'light', label: es.theme.light, Icon: Sun },
    { v: 'dark', label: es.theme.dark, Icon: Moon },
  ];
  return (
    <fieldset>
      <legend className="field-label">Tema</legend>
      <div className="radio-list">
        {opts.map(({ v, label, Icon }) => (
          <label key={v} className="check">
            <input type="radio" name="theme" value={v} checked={value === v} onChange={() => onChange(v)} />
            <Icon size={16} aria-hidden="true" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
