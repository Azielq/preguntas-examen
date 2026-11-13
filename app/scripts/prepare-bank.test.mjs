import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bankLite, prepare, readSplit, recomposeBank, splitBank } from './prepare-bank.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bank = JSON.parse(readFileSync(join(ROOT, 'data', 'bank.json'), 'utf8'));
const report = JSON.parse(readFileSync(join(ROOT, 'data', 'import-report.json'), 'utf8'));

describe('prepare-bank', () => {
  it('recomponer los archivos generados en public/bank da exactamente data/bank.json', () => {
    const parts = readSplit(join(ROOT, 'public', 'bank'));
    const re = recomposeBank(parts);
    expect(re).toStrictEqual(bank);
    // Mismo texto serializado, sin depender del orden de claves de cada pregunta
    expect(JSON.stringify(re.questions.map((q) => q.id))).toBe(JSON.stringify(bank.questions.map((q) => q.id)));
  });

  it('core no incluye explanation ni fragment, y hay un archivo de fragmentos por sección', () => {
    const parts = splitBank(bank, report);
    expect(parts.core.every((q) => !('explanation' in q) && !('fragment' in q))).toBe(true);
    expect(Object.keys(parts.manifest.files.fragments).sort()).toEqual([...new Set(bank.questions.map((q) => q.section))].sort());
    expect(parts.manifest.bankVersion).toBe(bank.bankVersion);
    for (const f of [parts.manifest.files.core, parts.manifest.files.explanations, parts.manifest.files.pbq]) expect(f).toContain(bank.bankVersion);
  });

  it('copia las imágenes de página de Messer', () => {
    for (const q of bank.questions.filter((x) => x.doc === 'messer')) {
      expect(existsSync(join(ROOT, 'public', 'bank', q.fragment.questionImage))).toBe(true);
      expect(existsSync(join(ROOT, 'public', 'bank', q.fragment.answerImage))).toBe(true);
    }
  });

  it('copia las imágenes de las PBQ (extracto y libro completo) y cuenta PBQ por documento en el manifest', () => {
    for (const p of bank.pbq) {
      for (const img of [...p.images, ...(p.questionImages ?? []), ...(p.answerImages ?? [])]) expect(existsSync(join(ROOT, 'public', 'bank', img))).toBe(true);
    }
    const parts = splitBank(bank, report);
    const expected = {};
    for (const p of bank.pbq) expected[p.doc] = (expected[p.doc] ?? 0) + 1;
    expect(parts.manifest.pbqCounts).toEqual(expected);
    expect(parts.manifest.pbqCounts.messerfull).toBe(15);
    // messerfull: fragmentos de texto (sin imágenes de página para las preguntas de opción)
    for (const q of bank.questions.filter((x) => x.doc === 'messerfull')) expect(typeof q.fragment.question).toBe('string');
  });

  it('bank-lite incluye las preguntas de messerfull con bloques code, viñetas y múltiple de 3', async () => {
    const lite = (await import('../server/_generated/bank-lite.js')).default;
    const byId = new Map(lite.questions.map((q) => [q.id, q]));
    expect(lite.questions.filter((q) => q.doc === 'messerfull')).toHaveLength(report.stats.messerfull.found);
    expect(byId.get('msf-a014').correct).toEqual(['A', 'E', 'G']);
    expect(byId.get('msf-a014').options).toHaveLength(7);
    expect(byId.get('msf-c054').stem.some((b) => b.type === 'code')).toBe(true);
    expect(byId.get('msf-a014').stem.some((b) => b.text.startsWith('•'))).toBe(true);
  });

  it('falla con mensaje claro si import-report.json tiene otro bankVersion', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'secplus-'));
    mkdirSync(join(tmp, 'data'));
    writeFileSync(join(tmp, 'data', 'bank.json'), JSON.stringify({ ...bank, questions: bank.questions.slice(0, 2) }));
    writeFileSync(join(tmp, 'data', 'import-report.json'), JSON.stringify({ ...report, bankVersion: 'otra' }));
    expect(() => prepare({ root: tmp, quiet: true })).toThrow(/bankVersion/);
  });

  it('server/_generated/bank-lite.js coincide campo a campo con data/bank.json (sin fragmentos)', async () => {
    const lite = (await import('../server/_generated/bank-lite.js')).default;
    expect(lite).toStrictEqual(bankLite(bank));
    expect(lite.bankVersion).toBe(bank.bankVersion);
    expect(lite.questions.length).toBe(bank.questions.length);
    const FIELDS = ['id', 'doc', 'group', 'section', 'topic', 'stem', 'options', 'selectionType', 'correct', 'answerStatus', 'scorable', 'contentHash', 'duplicates'];
    lite.questions.forEach((q, i) => {
      const o = bank.questions[i];
      for (const f of FIELDS) expect(q[f]).toStrictEqual(o[f]);
      expect(q.review).toStrictEqual({ status: o.review.status });
      expect(q.explanation).toStrictEqual({ origin: o.explanation.origin, language: o.explanation.language, text: o.explanation.text, perOption: o.explanation.perOption });
      expect(q).not.toHaveProperty('fragment');
      expect(q).not.toHaveProperty('page');
    });
  });

  it('falla si falta data/bank.json', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'secplus-'));
    expect(() => prepare({ root: tmp, quiet: true })).toThrow(/falta/);
  });
});
