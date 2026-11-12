import { NavLink } from 'react-router-dom';
import { ThemeToggleButton } from '../ThemeToggle/ThemeToggle';
import { Brand, type NavItem } from './Sidebar';
import s from './Sidebar.module.css';

/** Encabezado superior móvil (56 px): marca, título, tema y ajustes. */
export function TopBar({
  title,
  settingsItem,
  resolvedTheme,
  onToggleTheme,
}: {
  title: string;
  settingsItem: NavItem;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme(): void;
}) {
  const Icon = settingsItem.icon;
  return (
    <header className={s.topbar}>
      <Brand compact />
      <span className={s.topTitle}>{title}</span>
      <ThemeToggleButton resolved={resolvedTheme} onToggle={onToggleTheme} />
      <NavLink to={settingsItem.to} className={s.topIcon} aria-label={settingsItem.label} title={settingsItem.label}>
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </NavLink>
    </header>
  );
}
