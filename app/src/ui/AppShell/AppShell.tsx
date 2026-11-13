import type { ReactNode } from 'react';
import { MQ, useMediaQuery } from '../../hooks/useMediaQuery';
import { es } from '../../i18n/es';
import { BottomNav } from '../BottomNav/BottomNav';
import { Sidebar, type NavItem } from '../Sidebar/Sidebar';
import { TopBar } from '../Sidebar/TopBar';
import s from './AppShell.module.css';

export interface AppShellProps {
  children: ReactNode;
  focusMode?: boolean;
  /** pantalla de pregunta (práctica, examen, revisión, PBQ): con menos de 768 px no hay TopBar ni BottomNav */
  questionScreen?: boolean;
  items: NavItem[];
  settingsItem: NavItem;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme(): void;
  mobileTitle: string;
  examRunning: boolean;
}

export function AppShell({ children, focusMode, questionScreen, items, settingsItem, resolvedTheme, onToggleTheme, mobileTitle, examRunning }: AppShellProps) {
  const mobile = useMediaQuery(MQ.mobile);
  const noMobileChrome = !!questionScreen && mobile;
  return (
    <div className={`${s.shell} ${focusMode ? s.focus : ''} ${questionScreen ? s.qscreen : ''}`}>
      <a className={s.skip} href="#contenido">
        {es.skipLink}
      </a>
      {!focusMode && (
        <>
          <Sidebar items={items} settingsItem={settingsItem} resolvedTheme={resolvedTheme} onToggleTheme={onToggleTheme} examRunning={examRunning} />
          {!noMobileChrome && <TopBar title={mobileTitle} settingsItem={settingsItem} resolvedTheme={resolvedTheme} onToggleTheme={onToggleTheme} />}
        </>
      )}
      <main id="contenido" tabIndex={-1} className={s.main}>
        <div className={s.container}>{children}</div>
      </main>
      {!focusMode && !noMobileChrome && <BottomNav items={items.slice(0, 5)} examRunning={examRunning} />}
    </div>
  );
}

export type { NavItem };
