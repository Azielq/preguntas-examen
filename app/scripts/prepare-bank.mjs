// Reparte data/bank.json en public/bank/ para una carga eficiente.
// Solo reparte y copia: no modifica ningún string del banco.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function splitBank(bank, importReport) {
  const v = bank.bankVersion;
  const sectionsMap = new Map();
  const core = [];
  const explanations = {};
  const fragments = {};
  for (const q of bank.questions) {
    const { explanation, fragment, ...rest } = q;
    core.push(rest);
    explanations[q.id] = explanation;
    (fragments[q.section] ??= {})[q.id] = fragment;
    const s = sectionsMap.get(q.section);
    if (s) s.count += 1;
    else sectionsMap.set(q.section, { section: q.section, doc: q.doc, group: q.group, topic: q.topic, count: 1 });
  }
  const files = {
    core: `core.${v}.json`,
    explanations: `explanations.${v}.json`,
    pbq: `pbq.${v}.json`,
    fragments: Object.fromEntries(Object.keys(fragments).map((s) => [s, `fragments/${s}.${v}.json`])),
  };
  const manifest = {
    bankVersion: v,
    generatedAt: bank.generatedAt,
    documents: bank.documents,
    sections: [...sectionsMap.values()],
    importReport,
    files,
  };
  return { manifest, core, explanations, fragments, pbq: bank.pbq };
}

/** Recompone el banco original a partir de las piezas (usado por el test de igualdad). */
export function recomposeBank({ manifest, core, explanations, fragments, pbq }) {
  return {
    bankVersion: manifest.bankVersion,
    generatedAt: manifest.generatedAt,
    documents: manifest.documents,
    questions: core.map((q) => ({ ...q, explanation: explanations[q.id], fragment: fragments[q.section][q.id] })),
    pbq,
  };
}

/** Lee las piezas generadas desde disco. */
export function readSplit(outDir) {
  const read = (p) => JSON.parse(readFileSync(join(outDir, p), 'utf8'));
  const manifest = read('manifest.json');
  const fragments = {};
  for (const [s, f] of Object.entries(manifest.files.fragments)) fragments[s] = read(f);
  return {
    manifest,
    core: read(manifest.files.core),
    explanations: read(manifest.files.explanations),
    fragments,
    pbq: read(manifest.files.pbq),
  };
}

export function prepare({ root = ROOT, quiet = false } = {}) {
  const bankPath = join(root, 'data', 'bank.json');
  const reportPath = join(root, 'data', 'import-report.json');
  if (!existsSync(bankPath)) throw new Error(`prepare-bank: falta ${bankPath}. Generalo con scripts/build_bank.py.`);
  if (!existsSync(reportPath)) throw new Error(`prepare-bank: falta ${reportPath}.`);
  const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  if (report.bankVersion !== bank.bankVersion) {
    throw new Error(
      `prepare-bank: import-report.json tiene bankVersion ${report.bankVersion} y bank.json ${bank.bankVersion}. Regenerá ambos con scripts/build_bank.py.`,
    );
  }
  const out = join(root, 'public', 'bank');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'fragments'), { recursive: true });
  const parts = splitBank(bank, report);
  const write = (p, data) => writeFileSync(join(out, p), JSON.stringify(data), 'utf8');
  write('manifest.json', parts.manifest);
  write(parts.manifest.files.core, parts.core);
  write(parts.manifest.files.explanations, parts.explanations);
  write(parts.manifest.files.pbq, parts.pbq);
  for (const [s, f] of Object.entries(parts.manifest.files.fragments)) write(f, parts.fragments[s]);
  // Imágenes de página (copia byte a byte)
  const pagesSrc = join(root, 'data', 'pages');
  if (existsSync(pagesSrc)) {
    for (const docDir of readdirSync(pagesSrc)) {
      mkdirSync(join(out, 'pages', docDir), { recursive: true });
      for (const f of readdirSync(join(pagesSrc, docDir))) copyFileSync(join(pagesSrc, docDir, f), join(out, 'pages', docDir, f));
    }
  }
  if (!quiet) console.log(`prepare-bank: banco ${bank.bankVersion} → ${out} (${bank.questions.length} preguntas, ${bank.pbq.length} PBQ)`);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    prepare();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
