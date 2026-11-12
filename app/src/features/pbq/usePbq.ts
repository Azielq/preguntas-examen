import { useEffect } from 'react';
import { useBank } from '../../bank/BankProvider';
import { useContent } from '../../state/contentStore';

export function usePbq() {
  const bank = useBank();
  const pbq = useContent((s) => s.pbq);
  const status = useContent((s) => s.pbqStatus);
  useEffect(() => {
    useContent.getState().ensurePbq(bank.manifest);
  }, [bank]);
  return { pbq, status, retry: () => useContent.getState().ensurePbq(bank.manifest, true) };
}
