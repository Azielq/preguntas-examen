import type { DocId } from '../../bank/types';
import type { PracticeFilter } from '../../storage/schema';

const STATE_Q: Record<string, NonNullable<PracticeFilter['state']>> = {
  todas: 'all',
  'sin-responder': 'unanswered',
  falladas: 'failed',
  marcadas: 'flagged',
  'pendientes-revision': 'pending_review',
};
const STATE_TO_Q = Object.fromEntries(Object.entries(STATE_Q).map(([k, v]) => [v, k])) as Record<string, string>;

export function filterFromQuery(sp: URLSearchParams): PracticeFilter {
  const f: PracticeFilter = {};
  const doc = sp.get('doc');
  if (doc === 'gorgotsias' || doc === 'messer') f.doc = doc as DocId;
  const sec = sp.get('sec');
  if (sec) f.section = sec;
  const st = sp.get('estado');
  if (st && STATE_Q[st]) f.state = STATE_Q[st];
  if (sp.get('fav') === '1') f.onlyFavorites = true;
  const lista = sp.get('lista');
  if (lista === 'falladas' || lista === 'marcadas' || lista === 'favoritas') f.list = lista;
  else if (lista?.startsWith('intento:')) f.list = `attempt:${lista.slice('intento:'.length)}`;
  return f;
}

export function filterToQuery(f: PracticeFilter): string {
  const sp = new URLSearchParams();
  if (f.list) sp.set('lista', f.list.startsWith('attempt:') ? `intento:${f.list.slice(8)}` : f.list);
  if (f.doc) sp.set('doc', f.doc);
  if (f.section) sp.set('sec', f.section);
  if (f.state && f.state !== 'all') sp.set('estado', STATE_TO_Q[f.state]!);
  if (f.onlyFavorites) sp.set('fav', '1');
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Clave estable de la sesión (lista congelada) para un filtro. */
export function filterKey(f: PracticeFilter): string {
  return filterToQuery(f) || '?';
}

export function practiceUrl(questionId: string, f: PracticeFilter, extra?: string): string {
  const q = filterToQuery(f);
  const e = extra ? (q ? `&${extra}` : `?${extra}`) : '';
  return `/practica/${questionId}${q}${e}`;
}
