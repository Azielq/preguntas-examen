/** Copia del banco del lado del servidor (bank-lite.js, generado por prepare-bank). */
import { chapterMap } from '../shared/analysis/chapters.js';
import bankLite from './_generated/bank-lite.js';
import type { LiteBank, LiteQuestion } from './bankTypes.js';

export interface ServerBank {
  bankVersion: string;
  byId: Map<string, LiteQuestion>;
  order: Map<string, number>;
  sections: Set<string>;
  chapter: Map<string, string | null>;
}

export function indexBank(lite: LiteBank): ServerBank {
  return {
    bankVersion: lite.bankVersion,
    byId: new Map(lite.questions.map((q) => [q.id, q])),
    order: new Map(lite.questions.map((q, i) => [q.id, i])),
    sections: new Set(lite.questions.map((q) => q.section)),
    chapter: chapterMap(lite.questions),
  };
}

let cached: ServerBank | null = null;

/** Importación estática: el empaquetado de la función incluye bank-lite.js. */
export function serverBank(): ServerBank {
  cached ??= indexBank(bankLite);
  return cached;
}
