import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { BankLoadError, loadBank } from './loadBank';
import type { LoadedBank } from './types';

export type BankState =
  | { status: 'loading' }
  | { status: 'ready'; bank: LoadedBank }
  | { status: 'error'; message: string; problems: string[] };

interface Ctx {
  state: BankState;
  retry(): void;
}

const BankContext = createContext<Ctx | null>(null);

export function BankProvider({ children, loader = loadBank }: { children: ReactNode; loader?: () => Promise<LoadedBank> }) {
  const [state, setState] = useState<BankState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loader().then(
      (bank) => alive && setState({ status: 'ready', bank }),
      (e: unknown) =>
        alive &&
        setState({
          status: 'error',
          message: e instanceof Error ? e.message : String(e),
          problems: e instanceof BankLoadError ? e.problems : [],
        }),
    );
    return () => {
      alive = false;
    };
  }, [loader, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return <BankContext.Provider value={{ state, retry }}>{children}</BankContext.Provider>;
}

export function useBankState(): Ctx {
  const c = useContext(BankContext);
  if (!c) throw new Error('useBankState fuera de BankProvider');
  return c;
}

/** Solo para componentes que se montan con el banco listo (debajo de BankGate). */
export function useBank(): LoadedBank {
  const { state } = useBankState();
  if (state.status !== 'ready') throw new Error('Banco no disponible');
  return state.bank;
}
