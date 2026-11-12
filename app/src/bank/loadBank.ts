import { buildIndexes } from './indexes';
import type { Explanation, Fragment, LoadedBank, Manifest, PbqSolution, Question } from './types';
import { validateQuestions } from './validate';

export const BANK_BASE = `${import.meta.env.BASE_URL}bank/`;

export function assetUrl(path: string): string {
  return BANK_BASE + path;
}

export class BankLoadError extends Error {
  constructor(
    message: string,
    public problems: string[] = [],
  ) {
    super(message);
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new BankLoadError(`HTTP ${res.status} al pedir ${path}`);
  return (await res.json()) as T;
}

export async function loadBank(): Promise<LoadedBank> {
  const manifest = await fetchJson<Manifest>('manifest.json');
  const core = await fetchJson<unknown>(manifest.files.core);
  const problems = validateQuestions(core);
  if (problems.length > 0) throw new BankLoadError('El banco no pasó la validación.', problems);
  const questions = core as Question[];
  return { manifest, questions, indexes: buildIndexes(questions) };
}

export function loadExplanations(manifest: Manifest): Promise<Record<string, Explanation>> {
  return fetchJson(manifest.files.explanations);
}

export function loadFragments(manifest: Manifest, section: string): Promise<Record<string, Fragment>> {
  const f = manifest.files.fragments[section];
  if (!f) return Promise.reject(new BankLoadError(`No hay fragmentos para la sección ${section}`));
  return fetchJson(f);
}

export function loadPbq(manifest: Manifest): Promise<PbqSolution[]> {
  return fetchJson(manifest.files.pbq);
}
