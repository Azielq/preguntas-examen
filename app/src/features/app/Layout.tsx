import { BookOpenCheck, LayoutDashboard, Network, RotateCcw, Settings as SettingsIcon, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useBankState } from '../../bank/BankProvider';
import { es } from '../../i18n/es';
import { useExam } from '../../state/examStore';
import { resolveTheme, usePrefs } from '../../state/prefsStore';
import { useToasts } from '../../state/toastStore';
import { AppShell, type NavItem } from '../../ui/AppShell/AppShell';
import { DashboardSkeleton, ErrorState, LoadingRegion } from '../../ui/States/States';
import { ToastRegion } from '../../ui/Toast/ToastRegion';
import { bootstrap } from './bootstrap';

const ITEMS: NavItem[] = [
  { to: '/', label: es.nav.home, icon: LayoutDashboard, end: true },
  { to: '/practica', label: es.nav.practice, icon: BookOpenCheck },
  { to: '/examen', label: es.nav.exam, icon: Timer, isExam: true },
  { to: '/repaso', label: es.nav.review, icon: RotateCcw },
  { to: '/pbq', label: es.nav.pbq, icon: Network },
];
const SETTINGS: NavItem = { to: '/ajustes', label: es.nav.settings, icon: SettingsIcon };

function mobileTitle(path: string): string {
  if (path.startsWith('/practica')) return es.nav.practice;
  if (path.startsWith('/examen')) return es.nav.exam;
  if (path.startsWith('/repaso')) return es.nav.review;
  if (path.startsWith('/pbq')) return 'Referencia PBQ';
  if (path.startsWith('/ajustes')) return es.nav.settings;
  return es.nav.home;
}

/** Clave de "pantalla": cambiar de pregunta dentro de la misma pantalla no mueve el foco al h1. */
function screenKey(path: string): string {
  return path.replace(/^\/practica\/[^/]+$/, '/practica/:q').replace(/\/revision\/\d+$/, '/revision/:n');
}

export function Layout() {
  const { state, retry } = useBankState();
  const loc = useLocation();
  const prefs = usePrefs((s) => s.prefs);
  const setPrefs = usePrefs((s) => s.set);
  const examActive = useExam((s) => s.active);
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const [booted, setBooted] = useState(false);
  const [resolved, setResolved] = useState(resolveTheme(prefs.theme));

  useEffect(() => {
    if (state.status === 'ready') {
      bootstrap(state.bank);
      setBooted(true);
    }
  }, [state]);

  useEffect(() => {
    setResolved(resolveTheme(prefs.theme));
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = () => setResolved(resolveTheme(usePrefs.getState().prefs.theme));
    mq?.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, [prefs.theme]);

  // Foco al h1 al cambiar de pantalla (no en la primera carga).
  const lastScreen = useRef<string | null>(null);
  const key = screenKey(loc.pathname);
  useEffect(() => {
    if (lastScreen.current === null) {
      lastScreen.current = key;
      return;
    }
    if (lastScreen.current === key) return;
    lastScreen.current = key;
    const id = requestAnimationFrame(() => {
      const h1 = document.querySelector<HTMLElement>('main h1');
      if (h1) {
        if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: false });
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(id);
  }, [key]);

  const focusMode = loc.pathname === '/examen/en-curso' && !!examActive;
  let content;
  if (state.status === 'error') {
    content = (
      <ErrorState
        title={es.bank.loadError}
        detail={
          <>
            <p>{state.message}</p>
            {state.problems.length > 0 && (
              <ul>
                {state.problems.slice(0, 50).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </>
        }
        onRetry={retry}
      />
    );
  } else if (state.status === 'loading' || !booted) {
    content = (
      <LoadingRegion>
        <DashboardSkeleton />
      </LoadingRegion>
    );
  } else {
    content = <Outlet />;
  }

  return (
    <>
      <AppShell
        focusMode={focusMode}
        items={ITEMS}
        settingsItem={SETTINGS}
        resolvedTheme={resolved}
        onToggleTheme={() => setPrefs({ theme: resolved === 'dark' ? 'light' : 'dark' })}
        mobileTitle={mobileTitle(loc.pathname)}
        examRunning={!!examActive}
      >
        {content}
      </AppShell>
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
