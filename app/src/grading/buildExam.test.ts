import { describe, expect, it } from 'vitest';
import { loadedBank } from '../test/bankFixture';
import { buildExam, examCandidates, seededRng } from './buildExam';
import { isScorable } from './grade';
import type { ExamConfig } from './types';

const bank = loadedBank();
const { units, byId, unitOf } = bank.indexes;
const cfg = (c: Partial<ExamConfig>): ExamConfig => ({ source: 'both', count: 10000, timerMinutes: null, includeAiProposed: false, ...c });

describe('buildExam', () => {
  it('máximos: todos 793, Gorgotsias 538, Messer extracto 45, Messer libro completo 255 y combinaciones', () => {
    expect(buildExam(bank.questions, units, byId, cfg({}), seededRng(1)).length).toBe(793);
    expect(buildExam(bank.questions, units, byId, cfg({ docs: ['gorgotsias', 'messer', 'messerfull'] }), seededRng(1)).length).toBe(793);
    expect(buildExam(bank.questions, units, byId, cfg({ source: 'gorgotsias' }), seededRng(2)).length).toBe(538);
    expect(buildExam(bank.questions, units, byId, cfg({ source: 'messer' }), seededRng(3)).length).toBe(45);
    expect(buildExam(bank.questions, units, byId, cfg({ source: 'messerfull' }), seededRng(3)).length).toBe(255);
    // el extracto está contenido en el libro completo: juntos siguen siendo 255 preguntas distintas
    expect(buildExam(bank.questions, units, byId, cfg({ docs: ['messer', 'messerfull'] }), seededRng(4)).length).toBe(255);
    expect(buildExam(bank.questions, units, byId, cfg({ docs: ['gorgotsias', 'messer'] }), seededRng(4)).length).toBe(583);
    expect(buildExam(bank.questions, units, byId, cfg({ docs: ['gorgotsias', 'messerfull'] }), seededRng(4)).length).toBe(793);
  });

  it('las 45 del extracto y msf-a046..a090 son una sola unidad cada una; con ambos documentos se usa la copia del libro completo', () => {
    for (let n = 46; n <= 90; n++) {
      const a = `msr-a0${n}`;
      const b = `msf-a0${n}`;
      expect(unitOf.get(a)).toBe(unitOf.get(b));
      const words = (id: string) => byId.get(id)!.stem.map((x) => x.text).join(' ').split(/\s+/).join(' ');
      expect(words(a)).toBe(words(b));
      expect(byId.get(a)!.options.map((o) => o.text)).toEqual(byId.get(b)!.options.map((o) => o.text));
      expect(byId.get(a)!.correct).toEqual(byId.get(b)!.correct);
    }
    // dato del banco: en 5 pares el extracto parte el enunciado en otros bloques (renglones sueltos o prosa como
    // `code`), así que el contentHash difiere aunque el texto sea el mismo
    const diffHash = [];
    for (let n = 46; n <= 90; n++) if (byId.get(`msr-a0${n}`)!.contentHash !== byId.get(`msf-a0${n}`)!.contentHash) diffHash.push(n);
    expect(diffHash).toEqual([52, 55, 64, 70, 79]);
    const c = examCandidates(bank.questions, units, byId, { source: 'both', docs: ['messer', 'messerfull'], includeAiProposed: false });
    expect(c.some((q) => q.doc === 'messer')).toBe(false);
    // solo el extracto: sigue usando sus propias copias
    const m = examCandidates(bank.questions, units, byId, { source: 'messer', includeAiProposed: false });
    expect(m.every((q) => q.doc === 'messer')).toBe(true);
  });

  it('las preguntas de selección múltiple del libro completo entran al examen (2 y 3 correctas)', () => {
    const c = examCandidates(bank.questions, units, byId, { source: 'messerfull', includeAiProposed: false });
    const multi = c.filter((q) => q.selectionType === 'multiple');
    expect(multi.map((q) => q.id).sort()).toEqual(['msf-a014', 'msf-a023', 'msf-a080', 'msf-b039', 'msf-b057', 'msf-b072', 'msf-b081', 'msf-c054', 'msf-c082']);
    expect(byId.get('msf-a014')!.correct).toEqual(['A', 'E', 'G']);
  });

  for (const seed of [1, 7, 42, 1234, 99999]) {
    it(`semilla ${seed}: sin unidades repetidas, solo puntuables, sin gor-sim6-0514`, () => {
      const items = buildExam(bank.questions, units, byId, cfg({}), seededRng(seed));
      const unitIds = items.map((i) => unitOf.get(i.questionId));
      expect(new Set(unitIds).size).toBe(items.length);
      expect(items.every((i) => isScorable(byId.get(i.questionId)!))).toBe(true);
      expect(items.some((i) => i.questionId === 'gor-sim6-0514')).toBe(false);
      expect(items.every((i) => i.contentHash === byId.get(i.questionId)!.contentHash && i.selected.length === 0 && !i.flagged)).toBe(true);
    });
  }

  it('la unidad de gor-sim6-0514 está representada por gor-cap4-0414', () => {
    expect(unitOf.get('gor-sim6-0514')).toBe(unitOf.get('gor-cap4-0414'));
    const items = buildExam(bank.questions, units, byId, cfg({}), seededRng(5));
    expect(items.some((i) => i.questionId === 'gor-cap4-0414')).toBe(true);
    // aun limitando a sim6, la pendiente no entra
    const sim6 = buildExam(bank.questions, units, byId, cfg({ sections: ['sim6'] }), seededRng(5));
    expect(sim6.some((i) => i.questionId === 'gor-sim6-0514')).toBe(false);
  });

  it('el representante prefiere la copia de capítulo', () => {
    const c = examCandidates(bank.questions, units, byId, { source: 'both', includeAiProposed: false });
    for (const q of c) {
      const u = units.get(unitOf.get(q.id)!)!;
      const capCopies = u.members.map((id) => byId.get(id)!).filter((x) => x.group === 'cap' && isScorable(x));
      if (capCopies.length > 0) expect(q.group).toBe('cap');
    }
  });

  it('la cantidad pedida se respeta y el orden es aleatorio pero reproducible', () => {
    const a = buildExam(bank.questions, units, byId, cfg({ count: 45 }), seededRng(11));
    const b = buildExam(bank.questions, units, byId, cfg({ count: 45 }), seededRng(11));
    const c = buildExam(bank.questions, units, byId, cfg({ count: 45 }), seededRng(12));
    expect(a.length).toBe(45);
    expect(a.map((i) => i.questionId)).toEqual(b.map((i) => i.questionId));
    expect(a.map((i) => i.questionId)).not.toEqual(c.map((i) => i.questionId));
  });

  it('no reordena opciones: los ítems solo referencian ids y el banco queda intacto', () => {
    const before = JSON.stringify(bank.questions.map((q) => q.options));
    buildExam(bank.questions, units, byId, cfg({}), seededRng(3));
    expect(JSON.stringify(bank.questions.map((q) => q.options))).toBe(before);
    for (const q of bank.questions) expect(q.options.map((o) => o.letter)).toEqual([...q.options.map((o) => o.letter)].sort());
  });

  it('limitar a secciones solo toma preguntas de esas secciones', () => {
    const items = buildExam(bank.questions, units, byId, cfg({ source: 'gorgotsias', sections: ['cap1', 'sim2'] }), seededRng(9));
    expect(items.every((i) => ['cap1', 'sim2'].includes(byId.get(i.questionId)!.section))).toBe(true);
  });
});
