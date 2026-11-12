import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { prepare, readSplit, recomposeBank, splitBank } from './prepare-bank.mjs';

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

  it('falla con mensaje claro si import-report.json tiene otro bankVersion', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'secplus-'));
    mkdirSync(join(tmp, 'data'));
    writeFileSync(join(tmp, 'data', 'bank.json'), JSON.stringify({ ...bank, questions: bank.questions.slice(0, 2) }));
    writeFileSync(join(tmp, 'data', 'import-report.json'), JSON.stringify({ ...report, bankVersion: 'otra' }));
    expect(() => prepare({ root: tmp, quiet: true })).toThrow(/bankVersion/);
  });

  it('falla si falta data/bank.json', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'secplus-'));
    expect(() => prepare({ root: tmp, quiet: true })).toThrow(/falta/);
  });
});
