/**
 * Contenido sintético de prueba para el layout (PLAN-LAYOUT 15.2). No sale de ningún PDF y nunca entra al build
 * de producción: lo usan Vitest y scripts/e2e-layout.mjs (que lo inyecta interceptando la red).
 */
import type { Explanation, Option, Review, StemBlock } from '../bank/types';

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu'];

/** Texto de exactamente `n` caracteres (palabras sintéticas separadas por espacios, terminado en punto). */
export function filler(n: number, seed = 0): string {
  let out = '';
  let i = seed;
  while (out.length < n) {
    out += (out ? ' ' : '') + WORDS[i % WORDS.length];
    i += 7;
  }
  out = out.slice(0, Math.max(1, n - 1)).trimEnd();
  while (out.length < n - 1) out += 'x';
  return `${out}.`;
}

export interface LayoutFixture {
  key: string;
  stem: StemBlock[];
  options: Option[];
  selectionType: 'single' | 'multiple';
  correct: string[];
  explanation?: Explanation;
  review?: Review;
}

const LETTERS = 'ABCDEFG';
function opts(id: string, n: number, len: number): Option[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${id}-${LETTERS[i]}`, letter: LETTERS[i]!, text: filler(len, i * 3 + 1) }));
}

const LONG_WORD = 'Q'.repeat(150) + 'W'.repeat(150);
const LONG_URL = `https://example.invalid/${'path-segment/'.repeat(20)}`.slice(0, 200);

/** Fixtures por nombre (sección 15.2). `id` es el de la pregunta real cuyo contenido se sustituye en el e2e. */
export function layoutFixtures(): Record<string, LayoutFixture & { id: string }> {
  const code = Array.from({ length: 30 }, (_, i) => `${String(i + 1).padStart(2, '0')} ${'log-entry '.repeat(14).slice(0, 137)}`).join('\n');
  const f = (id: string, x: LayoutFixture) => ({ ...x, id });
  return {
    corta: f('gor-cap1-0002', { key: 'corta', stem: [{ type: 'text', text: filler(80, 1) }], options: opts('gor-cap1-0002', 4, 12), selectionType: 'single', correct: ['A'] }),
    mediana: f('gor-cap1-0003', { key: 'mediana', stem: [{ type: 'text', text: filler(300, 2) }], options: opts('gor-cap1-0003', 4, 35), selectionType: 'single', correct: ['B'] }),
    'enunciado-largo': f('gor-cap1-0004', {
      key: 'enunciado-largo',
      stem: [
        { type: 'text', text: filler(500, 3) },
        { type: 'text', text: filler(500, 4) },
        { type: 'text', text: filler(500, 5) },
      ],
      options: opts('gor-cap1-0004', 4, 35),
      selectionType: 'single',
      correct: ['C'],
    }),
    'opciones-largas': f('gor-cap1-0005', { key: 'opciones-largas', stem: [{ type: 'text', text: filler(300, 6) }], options: opts('gor-cap1-0005', 5, 400), selectionType: 'single', correct: ['D'] }),
    codigo: f('gor-cap1-0006', {
      key: 'codigo',
      stem: [
        { type: 'text', text: filler(120, 7) },
        { type: 'code', text: code },
        { type: 'text', text: filler(80, 8) },
      ],
      options: opts('gor-cap1-0006', 4, 30),
      selectionType: 'single',
      correct: ['A'],
    }),
    'palabra-larga': f('gor-cap1-0007', {
      key: 'palabra-larga',
      stem: [{ type: 'text', text: `${filler(60, 9)} ${LONG_WORD} ${LONG_URL}` }],
      options: [
        { id: 'gor-cap1-0007-A', letter: 'A', text: LONG_WORD },
        { id: 'gor-cap1-0007-B', letter: 'B', text: LONG_URL },
        { id: 'gor-cap1-0007-C', letter: 'C', text: filler(30, 10) },
        { id: 'gor-cap1-0007-D', letter: 'D', text: filler(30, 11) },
      ],
      selectionType: 'single',
      correct: ['C'],
      explanation: { origin: 'pdf', language: 'en', text: `${LONG_WORD} ${LONG_URL} ${filler(200, 12)}`, perOption: { A: LONG_WORD, B: LONG_URL, D: filler(100, 13) } },
    }),
    multiple: f('gor-cap1-0008', {
      key: 'multiple',
      stem: [{ type: 'text', text: `${filler(200, 14)} (Select THREE)` }],
      options: opts('gor-cap1-0008', 7, 40),
      selectionType: 'multiple',
      correct: ['A', 'C', 'F'],
    }),
    'explicacion-pdf-larga': f('gor-cap1-0009', {
      key: 'explicacion-pdf-larga',
      stem: [{ type: 'text', text: filler(300, 15) }],
      options: opts('gor-cap1-0009', 4, 35),
      selectionType: 'single',
      correct: ['A'],
      explanation: { origin: 'pdf', language: 'en', text: filler(3000, 16), perOption: { A: filler(600, 17), B: filler(600, 18), C: filler(600, 19), D: filler(600, 20) } },
    }),
    'explicacion-ia-larga': f('gor-cap1-0010', {
      key: 'explicacion-ia-larga',
      stem: [{ type: 'text', text: filler(300, 21) }],
      options: opts('gor-cap1-0010', 4, 35),
      selectionType: 'single',
      correct: ['B'],
      explanation: { origin: 'ai', language: 'es', text: filler(2000, 22), perOption: {} },
    }),
    'pendiente-larga': f('gor-cap1-0011', {
      key: 'pendiente-larga',
      stem: [{ type: 'text', text: filler(300, 23) }],
      options: opts('gor-cap1-0011', 4, 35),
      selectionType: 'single',
      correct: ['C'],
      review: { status: 'pending', reasons: [filler(400, 24), filler(400, 25), filler(400, 26)], notes: [] },
    }),
  };
}
