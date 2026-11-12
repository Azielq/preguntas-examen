import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BankProvider } from '../bank/BankProvider';
import type { LoadedBank } from '../bank/types';
import { __resetBoot } from '../features/app/bootstrap';
import { AppRoutes } from '../routes';
import { useContent } from '../state/contentStore';
import { useExam } from '../state/examStore';
import { usePracticeSession } from '../state/practiceSession';
import { DEFAULT_PREFS, emptyAttempts, emptyProgress } from '../storage/schema';
import { usePrefs } from '../state/prefsStore';
import { useProgress } from '../state/progressStore';
import { useToasts } from '../state/toastStore';
import { explanationsMap, fragmentsBySection, loadedBank, readRaw } from './bankFixture';

export function resetStores(bank: LoadedBank, opts: { preloadContent?: boolean } = {}) {
  __resetBoot();
  useProgress.setState({ state: emptyProgress(bank.manifest.bankVersion) });
  useExam.setState({ active: null, attempts: emptyAttempts(), externalChangeAt: null });
  usePracticeSession.setState({ key: null, ids: [], checked: {} });
  usePrefs.setState({ prefs: { ...DEFAULT_PREFS } });
  useToasts.setState({ toasts: [] });
  if (opts.preloadContent !== false) {
    useContent.setState({
      explanations: explanationsMap(),
      explanationsStatus: 'ready',
      fragments: fragmentsBySection(),
      pbq: readRaw().raw.pbq,
      pbqStatus: 'ready',
    });
  } else {
    useContent.setState({ explanations: null, explanationsStatus: 'idle', fragments: {}, pbq: null, pbqStatus: 'idle' });
  }
}

export function renderApp(path: string, opts: { loader?: () => Promise<LoadedBank>; preloadContent?: boolean; skipReset?: boolean } = {}) {
  const bank = loadedBank();
  if (!opts.skipReset) resetStores(bank, opts);
  const loader = opts.loader ?? (() => Promise.resolve(bank));
  return {
    bank,
    ...render(
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <BankProvider loader={loader}>
          <AppRoutes />
        </BankProvider>
      </MemoryRouter>,
    ),
  };
}
