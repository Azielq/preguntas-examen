import { useEffect } from 'react';
import { useBank } from '../../bank/BankProvider';
import type { Explanation, Fragment, Question } from '../../bank/types';
import { useContent } from '../../state/contentStore';

export function useExplanation(q: Question, needed: boolean): { value: Explanation | 'loading' | 'error'; retry(): void } {
  const bank = useBank();
  const status = useContent((s) => s.explanationsStatus);
  const data = useContent((s) => s.explanations);
  useEffect(() => {
    if (needed) useContent.getState().ensureExplanations(bank.manifest);
  }, [needed, bank]);
  const retry = () => useContent.getState().retryExplanations(bank.manifest);
  if (status === 'error') return { value: 'error', retry };
  if (status !== 'ready' || !data) return { value: 'loading', retry };
  return { value: data[q.id] ?? 'error', retry };
}

export function useFragment(q: Question, open: boolean): { value: Fragment | 'loading' | 'error'; retry(): void } {
  const bank = useBank();
  const entry = useContent((s) => s.fragments[q.section]);
  useEffect(() => {
    if (open) useContent.getState().ensureFragments(bank.manifest, q.section);
  }, [open, bank, q.section]);
  const retry = () => useContent.getState().ensureFragments(bank.manifest, q.section, true);
  if (entry === 'error') return { value: 'error', retry };
  if (!entry || entry === 'loading') return { value: 'loading', retry };
  return { value: entry[q.id] ?? 'error', retry };
}
