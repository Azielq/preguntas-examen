/**
 * Prueba de integración REAL con la API de Anthropic (PLAN-IA 12.3). No forma parte de `npm test`.
 * CADA EJECUCIÓN GASTA DINERO. Uso: ANTHROPIC_API_KEY=... npm run ai:smoke -- --yes
 * Llama al núcleo del servidor (handleAnalyze) con el proveedor real y 2 intentos de fixture.
 */
import { serverBank } from '../server/bank.js';
import { handleAnalyze, type LogEntry } from '../server/handler.js';
import { item, post, request, TOKEN } from '../server/testHelpers.js';
import type { AnalyzeResponse, ErrorBody } from '../shared/analysis/contract.js';
import { deriveAnalysis } from '../shared/analysis/derive.js';
import { chapterMap } from '../shared/analysis/chapters.js';

if (!process.argv.includes('--yes')) {
  console.error('ai:smoke llama a la API real y gasta dinero. Repetilo con --yes si querés continuar.');
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Falta ANTHROPIC_API_KEY en el entorno.');
  process.exit(2);
}

const bank = serverBank();
const env = { ...process.env, AI_ACCESS_TOKEN: TOKEN, AI_PROVIDER: 'anthropic' };
const fixtures = {
  'seis errores variados (incluye msr-a080)': request([
    item('gor-cap1-0002', 'incorrect'),
    item('gor-cap1-0003', 'incorrect'),
    item('gor-cap2-0112', 'incorrect'),
    item('gor-cap4-0414', 'incorrect'),
    item('msr-a052', 'omitted'),
    item('msr-a080', 'incorrect'),
    item('gor-cap1-0001', 'correct'),
    item('gor-cap2-0111', 'correct'),
  ]),
  'un solo error': request([item('gor-cap3-0261', 'incorrect'), item('gor-cap1-0001', 'correct')]),
};

let failed = 0;
for (const [name, req] of Object.entries(fixtures)) {
  const logs: LogEntry[] = [];
  const r = await handleAnalyze(post(req), { env, bank: serverBank, log: (e) => logs.push(e) });
  const l = logs[0];
  console.log(`\n== ${name}: HTTP ${r.status} · ${l?.durationMs} ms · tokens entrada ${l?.inputTokens} / salida ${l?.outputTokens} · ${l?.code}`);
  if (r.status !== 200) {
    console.log((JSON.parse(r.body) as ErrorBody).error);
    failed += 1;
    continue;
  }
  const res = JSON.parse(r.body) as AnalyzeResponse;
  console.log('reparaciones:', res.repairs);
  console.log(JSON.stringify(res.output, null, 2));
  if (name === 'un solo error') {
    const chapters = chapterMap([...bank.byId.values()]);
    const d = deriveAnalysis({
      output: res.output,
      items: req.attempt.items.map((i) => ({ questionId: i.id, result: i.result })),
      bank: {
        questions: [...bank.byId.values()],
        isScorable: () => true,
        unitOf: (id) => id,
        unitMembers: (u) => [u],
        chapterOf: (id) => chapters.get(id) ?? null,
      },
      progress: {},
    });
    const high = Object.values(d.priorities).some((p) => p.level === 'alta');
    const backed = res.output.concepts.some((k) => k.confusions.some((c) => c.evidence === 'respaldada'));
    console.log(`prioridad alta: ${high} · confusión respaldada: ${backed}`);
    if (high || backed) failed += 1;
  }
}
console.log(failed ? `\n${failed} caso(s) con problemas` : '\nOK');
process.exit(failed ? 1 : 0);
