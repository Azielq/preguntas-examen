import type { ReactNode } from 'react';
import { es } from '../../i18n/es';
import { BottomNav } from '../BottomNav/BottomNav';
import { Sidebar, type NavItem } from '../Sidebar/Sidebar';
import { TopBar } from '../Sidebar/TopBar';
import s from './AppShell.module.css';

export interface AppShellProps {
  children: ReactNode;
  focusMode?: boolean;
  items: NavItem[];
  settingsItem: NavItem;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme(): void;
  mobileTitle: string;
  examRunning: boolean;
}

export function AppShell({ children, focusMode, items, settingsItem, resolvedTheme, onToggleTheme, mobileTitle, examRunning }: AppShellProps) {
  return (
    <div className={`${s.shell} ${focusMode ? s.focus : ''}`}>
      <a className={s.skip} href="#contenido">
        {es.skipLink}
      </a>
      {!focusMode && (
        <>
          <Sidebar items={items} settingsItem={settingsItem} resolvedTheme={resolvedTheme} onToggleTheme={onToggleTheme} examRunning={examRunning} />
          <TopBar title={mobileTitle} settingsItem={settingsItem} resolvedTheme={resolvedTheme} onToggleTheme={onToggleTheme} />
        </>
      )}
      <main id="contenido" tabIndex={-1} className={s.main}>
        <div className={s.container}>{children}</div>
      </main>
      {!focusMode && <BottomNav items={items.slice(0, 5)} examRunning={examRunning} />}
    </div>
  );
}

export type { NavItem };
