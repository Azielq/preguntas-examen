import { NavLink } from 'react-router-dom';
import { es } from '../../i18n/es';
import type { NavItem } from '../Sidebar/Sidebar';
import s from './BottomNav.module.css';

/** Navegación inferior móvil: 5 ítems con icono y etiqueta. */
export function BottomNav({ items, examRunning }: { items: NavItem[]; examRunning: boolean }) {
  return (
    <nav aria-label={es.nav.label} className={s.nav}>
      <ul role="list" className={s.list}>
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.to} className={s.li}>
              <NavLink to={it.to} end={it.end} className={s.link}>
                <span className={s.iconWrap}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  {it.isExam && examRunning && (
                    <span className={s.dot}>
                      <span className="sr-only">({es.nav.examRunningHidden})</span>
                    </span>
                  )}
                </span>
                <span className={s.label}>{it.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
