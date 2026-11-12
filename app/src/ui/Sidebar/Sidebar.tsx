import { Check, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { es } from '../../i18n/es';
import { ThemeToggleButton } from '../ThemeToggle/ThemeToggle';
import s from './Sidebar.module.css';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  isExam?: boolean;
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <span className={s.brand}>
      <span className={s.mono} aria-hidden="true">
        <Check size={18} strokeWidth={3} />
      </span>
      {!compact && <span className={s.brandText}>{es.appName}</span>}
    </span>
  );
}

function Item({ item, examRunning }: { item: NavItem; examRunning: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink to={item.to} end={item.end} className={s.link} aria-label={undefined}>
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        <span className={s.label}>{item.label}</span>
        {item.isExam && examRunning && (
          <span className={s.dot}>
            <span className="sr-only">({es.nav.examRunningHidden})</span>
          </span>
        )}
        <span className={s.tip} aria-hidden="true">
          {item.label}
        </span>
      </NavLink>
    </li>
  );
}

/** Barra lateral: 264 px con texto (≥ 1100) o 72 px solo iconos con tooltip (768–1099). */
export function Sidebar({
  items,
  settingsItem,
  resolvedTheme,
  onToggleTheme,
  examRunning,
}: {
  items: NavItem[];
  settingsItem: NavItem;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme(): void;
  examRunning: boolean;
}) {
  return (
    <aside className={s.sidebar}>
      <div className={s.brandRow}>
        <Brand />
      </div>
      <nav aria-label={es.nav.label} className={s.nav}>
        <ul role="list" className={s.list}>
          {items.map((it) => (
            <Item key={it.to} item={it} examRunning={examRunning} />
          ))}
        </ul>
        <hr className={s.sep} />
        <ul role="list" className={s.list}>
          <Item item={settingsItem} examRunning={false} />
        </ul>
      </nav>
      <div className={s.bottom}>
        <span className={s.themeFull}>
          <ThemeToggleButton resolved={resolvedTheme} onToggle={onToggleTheme} showLabel />
        </span>
        <span className={s.themeCompact}>
          <ThemeToggleButton resolved={resolvedTheme} onToggle={onToggleTheme} />
        </span>
      </div>
    </aside>
  );
}
