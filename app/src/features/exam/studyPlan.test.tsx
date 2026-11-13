import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chapterMap } from '../../../shared/analysis/chapters';
import type { AiStatus, AnalyzeResponse, ModelOutput } from '../../../shared/analysis/contract';
import { es } from '../../i18n/es';
import { __resetAnalysisStore, useAnalysis } from '../../state/analysisStore';
import { useExam } from '../../state/examStore';
import { filterQuestions } from '../../state/selectors';
import { KEYS } from '../../storage/keys';
import type { ExamAttempt, StoredAnalysis } from '../../storage/schema';
import { BASIC, makeAttempt, storedFor, validOutput, type Spec } from '../../test/aiFixtures';
import { loadedBank } from '../../test/bankFixture';
import { renderApp, resetStores } from '../../test/renderApp';
import { buildPlanView } from './studyPlanModel';

const bank = loadedBank();

const STATUS_OK: AiStatus = { available: true, reason: 'ok', requiresToken: false, provider: 'anthropic', promptVersion: '2026-11-a', bankVersion: bank.manifest.bankVersion };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function responseFor(attempt: ExamAttempt, output: ModelOutput = validOutput(), provider: 'anthropic' | 'mock' = 'anthropic'): AnalyzeResponse {
  const failed = attempt.items.filter((i) => i.result !== 'correct').length;
  return {
    schemaVersion: 1,
    promptVersion: '2026-11-a',
    bankVersion: bank.manifest.bankVersion,
    provider,
    model: provider === 'mock' ? 'mock' : 'claude-sonnet-5-5',
    coverage: { failed, failedAnalyzed: failed, correctSent: attempt.items.length - failed, omitted: attempt.items.filter((i) => i.result === 'omitted').length, notScored: 0 },
    repairs: [],
    output,
  };
}

interface Setup {
  attempt?: ExamAttempt;
  analysis?: StoredAnalysis;
  status?: AiStatus | 'down' | 404;
  analyze?: (init: RequestInit) => Promise<Response>;
  token?: string;
}

function setup(o: Setup = {}) {
  const attempt = o.attempt ?? makeAttempt(bank);
  resetStores(bank);
  __resetAnalysisStore();
  localStorage.setItem(KEYS.attempts, JSON.stringify({ schemaVersion: 1, attempts: [attempt] }));
  if (o.analysis) localStorage.setItem(KEYS.analyses, JSON.stringify({ schemaVersion: 1, byAttempt: { [attempt.id]: o.analysis } }));
  if (o.token) localStorage.setItem(KEYS.aiAccess, JSON.stringify({ schemaVersion: 1, token: o.token }));
  const calls = { status: 0, analyze: 0, bodies: [] as unknown[], auth: [] as (string | null)[] };
  const status = o.status ?? STATUS_OK;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (String(url).endsWith('api/ai-status')) {
        calls.status += 1;
        if (status === 'down') throw new TypeError('Failed to fetch');
        if (status === 404) return new Response('<html>no</html>', { status: 404, headers: { 'content-type': 'text/html' } });
        return json(200, status);
      }
      if (String(url).endsWith('api/analyze')) {
        calls.analyze += 1;
        calls.bodies.push(JSON.parse(String(init.body)));
        calls.auth.push(new Headers(init.headers).get('authorization'));
        if (o.analyze) return o.analyze(init);
        return json(200, responseFor(attempt));
      }
      throw new Error(`fetch inesperado ${url}`);
    }),
  );
  return { attempt, calls };
}

const renderPlan = (a: ExamAttempt) => renderApp(`/examen/resultado/${a.id}/plan`, { skipReset: true });

afterEach(() => {
  vi.unstubAllGlobals();
  __resetAnalysisStore();
});

async function axeSerious() {
  const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe('Tu plan de estudio: flujo', () => {
  it('Resultado → Analizar → carga (aria-busy, región viva) → plan; foco al Resumen; se guarda; el pedido solo lleva ids/letras', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { attempt, calls } = setup({ analyze: async () => (await gate, json(200, responseFor(makeAttempt(bank)))) });
    const user = userEvent.setup();
    renderApp(`/examen/resultado/${attempt.id}`, { skipReset: true });
    const btn = await screen.findByRole('button', { name: 'Analizar mis resultados con IA' });
    expect(screen.getByText(/Se envían a Anthropic las preguntas de este intento/)).toBeInTheDocument();
    await user.click(btn);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu plan de estudio' })).toBeInTheDocument();
    expect(screen.getByText(/Suele tardar entre 20 segundos y 2 minutos/)).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    await waitFor(() => expect(screen.getAllByRole('status').some((s) => s.textContent === 'Analizando tus resultados…')).toBe(true));
    expect(await axeSerious()).toEqual([]);
    await act(async () => release());
    const summary = await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    await waitFor(() => expect(document.activeElement).toBe(summary));
    expect(screen.getAllByRole('status').some((s) => /Tu plan de estudio está listo: 0 temas de prioridad alta/.test(s.textContent ?? ''))).toBe(true);
    expect(calls.analyze).toBe(1);
    const sent = JSON.stringify(calls.bodies[0]);
    expect(sent).not.toContain(bank.indexes.byId.get('gor-cap1-0002')!.stem[0]!.text.slice(0, 20));
    expect(sent).not.toContain(attempt.id);
    expect(sent).not.toContain(String(attempt.finishedAt));
    expect(JSON.parse(localStorage.getItem(KEYS.analyses)!).byAttempt[attempt.id].attemptId).toBe(attempt.id);
    // el intento guardado no cambió
    expect(JSON.parse(localStorage.getItem(KEYS.attempts)!).attempts[0]).toEqual(attempt);
    expect(await axeSerious()).toEqual([]);
  });

  it('reabrir tras recargar muestra el plan sin un nuevo pedido', async () => {
    const attempt = makeAttempt(bank);
    const { calls } = setup({ attempt, analysis: storedFor(attempt, bank) });
    renderPlan(attempt);
    expect(await screen.findByRole('heading', { level: 2, name: 'Resumen' })).toBeInTheDocument();
    expect(screen.getByText(validOutput().summary)).toBeInTheDocument();
    expect(calls.analyze).toBe(0);
  });

  it('error con reintento: role="alert", mensaje de 3.4, nota intacta; Reintentar lanza un nuevo pedido', async () => {
    let n = 0;
    const attempt = makeAttempt(bank);
    const { calls } = setup({
      attempt,
      analyze: async () => (++n === 1 ? json(502, { error: { code: 'upstream_error', message: 'x', retryable: true } }) : json(200, responseFor(attempt))),
    });
    const user = userEvent.setup();
    renderPlan(attempt);
    await user.click(await screen.findByRole('button', { name: 'Analizar mis resultados con IA' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('El servicio de IA no respondió. Tu nota y la revisión no cambian.')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(within(alert).getByRole('heading', { level: 2 })));
    expect(localStorage.getItem(KEYS.analyses)).toBeNull();
    expect(await axeSerious()).toEqual([]);
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Resumen' })).toBeInTheDocument();
    expect(calls.analyze).toBe(2);
  });

  it('un doble clic no lanza dos pedidos; Cancelar vuelve a idle y devuelve el foco al botón', async () => {
    const attempt = makeAttempt(bank);
    const { calls } = setup({ attempt, analyze: () => new Promise<Response>(() => {}) });
    renderPlan(attempt);
    const btn = await screen.findByRole('button', { name: 'Analizar mis resultados con IA' });
    act(() => {
      btn.click();
      useAnalysis.getState().start(attempt, bank);
    });
    await screen.findByText(/Suele tardar/);
    expect(calls.analyze).toBe(1);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    const again = await screen.findByRole('button', { name: 'Analizar mis resultados con IA' });
    await waitFor(() => expect(document.activeElement).toBe(again));
  });

  it('una respuesta que no pasa la verificación del cliente no se guarda', async () => {
    const attempt = makeAttempt(bank);
    const out = validOutput();
    out.unassigned.push('gor-cap5-0001'); // no es del intento
    setup({ attempt, analyze: async () => json(200, responseFor(attempt, out)) });
    const user = userEvent.setup();
    renderPlan(attempt);
    await user.click(await screen.findByRole('button', { name: 'Analizar mis resultados con IA' }));
    expect(await screen.findByText('La IA devolvió una respuesta que no pudimos verificar. No se guardó nada.')).toBeInTheDocument();
    expect(localStorage.getItem(KEYS.analyses)).toBeNull();
  });

  it('el token cargado viaja en Authorization', async () => {
    const attempt = makeAttempt(bank);
    const { calls } = setup({ attempt, token: 'token-de-prueba-con-24-caracteres', status: { ...STATUS_OK, requiresToken: true } });
    const user = userEvent.setup();
    renderPlan(attempt);
    await user.click(await screen.findByRole('button', { name: 'Analizar mis resultados con IA' }));
    await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    expect(calls.auth[0]).toBe('Bearer token-de-prueba-con-24-caracteres');
  });
});

describe('estados sin IA', () => {
  it.each<[string, Setup['status'], RegExp]>([
    ['sin endpoint (404/HTML)', 404, /no está disponible en esta instalación/],
    ['red caída', 'down', /no está disponible en esta instalación/],
    ['no configurado', { ...STATUS_OK, available: false, reason: 'no_key' }, /no está configurado en este despliegue/],
  ])('%s: explica y no muestra el botón', async (_n, status, text) => {
    const { attempt } = setup({ status });
    renderPlan(attempt);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analizar mis resultados con IA' })).toBeNull();
    expect(await axeSerious()).toEqual([]);
  });

  it('falta token: indica cargarlo y enlaza a Ajustes', async () => {
    const { attempt } = setup({ status: { ...STATUS_OK, requiresToken: true } });
    renderPlan(attempt);
    expect(await screen.findByText('Para usar el análisis con IA cargá tu token de acceso.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Ajustes' })).toHaveAttribute('href', '/ajustes#ia');
  });

  it('intento sin errores: panel calculado, sin llamar a la IA y sin debilidades', async () => {
    const attempt = makeAttempt(bank, [
      ['gor-cap1-0001', 'correct'],
      ['gor-cap2-0111', 'correct'],
    ]);
    const { calls } = setup({ attempt });
    renderPlan(attempt);
    expect(await screen.findByText('Sin errores en este intento: 2 de 2 correctas.')).toBeInTheDocument();
    expect(screen.getByText('Para consolidar')).toBeInTheDocument();
    expect(document.querySelector('[data-origin="ai"]')).toBeNull();
    expect(calls.analyze).toBe(0);
    expect(await axeSerious()).toEqual([]);
  });

  it('todo omitido: no se llama a la IA y ofrece repasar las omitidas', async () => {
    const attempt = makeAttempt(bank, [
      ['gor-cap1-0002', 'omitted'],
      ['gor-cap1-0003', 'omitted'],
    ]);
    const { calls } = setup({ attempt });
    renderPlan(attempt);
    expect(await screen.findByRole('heading', { name: 'No hay respuestas incorrectas para analizar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Repasar las omitidas' })).toBeInTheDocument();
    expect(calls.analyze).toBe(0);
  });

  it('pregunta cambiada en el banco: no se puede analizar', async () => {
    const attempt = makeAttempt(bank);
    attempt.items[1]!.contentHash = 'otrohash00';
    setup({ attempt });
    renderPlan(attempt);
    expect(await screen.findByText(/Este intento no se puede analizar/)).toBeInTheDocument();
  });

  it('Resultado y Revisión funcionan igual con el endpoint caído', async () => {
    const { attempt } = setup({ status: 'down' });
    const user = userEvent.setup();
    renderApp(`/examen/resultado/${attempt.id}`, { skipReset: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Resultado del examen' })).toBeInTheDocument();
    expect(await screen.findByText(/no está disponible en esta instalación/)).toBeInTheDocument();
    expect(screen.getByText('40,0 %')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Revisar todas' }));
    expect(await screen.findByRole('article')).toHaveAttribute('data-question-id', 'gor-cap1-0001');
  });
});

describe('plan: contenido, accesibilidad y fidelidad', () => {
  const TEN: Spec[] = [
    ['gor-cap1-0002', 'incorrect'],
    ['gor-cap1-0003', 'incorrect'],
    ['gor-cap1-0004', 'incorrect'],
    ['gor-cap2-0112', 'incorrect'],
    ['gor-cap3-0261', 'incorrect'],
    ['gor-cap4-0414', 'incorrect'],
    ['gor-sim2-0113', 'incorrect'],
    ['gor-cap5-0461', 'omitted'],
    ['msr-a052', 'incorrect'],
    ['msr-a080', 'incorrect'],
    ['gor-cap1-0001', 'correct'],
    ['gor-cap2-0111', 'correct'],
  ];
  function tenOutput(): ModelOutput {
    const failed = TEN.filter(([, r]) => r !== 'correct').map(([id]) => id);
    const base = validOutput().concepts[0]!;
    return {
      ...validOutput(),
      concepts: [
        { ...base, id: 'c1', questionIds: failed.slice(0, 5), questionNotes: failed.slice(0, 5).map((id) => ({ questionId: id, note: `Nota de la IA ${id}` })), confusions: [{ ...base.confusions[0]!, questionIds: failed.slice(0, 2), evidence: 'respaldada' }] },
        { ...base, id: 'c2', name: 'Segundo concepto', questionIds: failed.slice(5), questionNotes: failed.slice(5).map((id) => ({ questionId: id, note: `Nota de la IA ${id}` })), confusions: [] },
      ],
      unassigned: [],
      keyFlags: [{ questionId: 'gor-cap4-0414', note: 'La clave parece contradecir su explicación.' }],
    };
  }

  it('textos del banco literales (10 ids, con msr-a052 y msr-a080), sin elementos script; IA siempre dentro de AiGenerated', async () => {
    const attempt = makeAttempt(bank, TEN);
    setup({ attempt, analysis: storedFor(attempt, bank, tenOutput()) });
    const user = userEvent.setup();
    renderPlan(attempt);
    await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    await user.click(screen.getByRole('button', { name: 'Abrir todas' }));
    // abrir todas las preguntas de evidencia
    document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
    for (const [id] of TEN.filter(([, r]) => r !== 'correct')) {
      const q = bank.indexes.byId.get(id)!;
      const blocks = [...document.querySelectorAll(`section[data-origin="pdf"][data-question-id="${id}"]`)];
      expect(blocks.length, id).toBeGreaterThan(0);
      const sec = blocks[0]!;
      const stemEls = [...sec.querySelectorAll('p[lang="en"], pre')];
      for (const b of q.stem) expect(stemEls.some((el) => el.textContent === b.text), `${id} stem`).toBe(true);
      for (const o of q.options) expect(sec.querySelector(`[data-letter="${o.letter}"] span[lang="en"]`)?.textContent, `${id} ${o.letter}`).toBe(o.text);
      expect(sec.closest('[data-origin="ai"]'), `${id} fuera de AiGenerated`).toBeNull();
    }
    expect(document.querySelectorAll('script').length).toBe(0);
    const a080 = document.querySelector('section[data-question-id="msr-a080"] pre')!;
    expect(a080.textContent).toContain('<script>alert(2)</script>');
    // cada texto de la IA está dentro de un [data-origin="ai"]
    const out = tenOutput();
    const aiTexts = [out.summary, out.concepts[0]!.reinforce, out.concepts[0]!.explanation, ...out.concepts[0]!.learnPoints, out.concepts[0]!.activity.text, 'Nota de la IA gor-cap1-0002', out.keyFlags[0]!.note, out.concepts[1]!.name];
    for (const t of aiTexts) {
      const nodes = screen.getAllByText((_c, el) => !!el && el.children.length === 0 && el.textContent === t);
      for (const n of nodes) expect(n.closest('[data-origin="ai"]'), t).not.toBeNull();
    }
    // confusión respaldada con 2 incorrectas, y keyFlags con su texto fijo
    expect(screen.getByText('Confusión observada — RESPALDADA')).toBeInTheDocument();
    expect(screen.getByText('La respuesta y tu nota no cambian. La referencia sigue siendo la solución del PDF.')).toBeInTheDocument();
    expect(screen.getAllByText(/Explicación en el PDF: Gorgotsias · pág\. \d+/).length).toBeGreaterThan(0);
    expect(await axeSerious()).toEqual([]);
  });

  it('acordeón: la primera de prioridad alta abierta; aria-expanded/aria-controls y panel hidden; operable con teclado', async () => {
    const attempt = makeAttempt(bank, TEN);
    setup({ attempt, analysis: storedFor(attempt, bank, tenOutput()) });
    const user = userEvent.setup();
    renderPlan(attempt);
    await screen.findByRole('heading', { level: 2, name: 'Prioridad alta (2)' });
    const toggles = document.querySelectorAll<HTMLButtonElement>('article[data-concept-id] h3 > button');
    expect(toggles.length).toBe(2);
    const [t1, t2] = [...toggles];
    expect(t1!.getAttribute('aria-expanded')).toBe('true');
    expect(t2!.getAttribute('aria-expanded')).toBe('false');
    const panel2 = document.getElementById(t2!.getAttribute('aria-controls')!)!;
    expect(panel2).toHaveAttribute('hidden');
    expect(panel2.getAttribute('role')).toBe('region');
    t2!.focus();
    await user.keyboard('{Enter}');
    expect(t2!.getAttribute('aria-expanded')).toBe('true');
    expect(panel2).not.toHaveAttribute('hidden');
    expect(document.activeElement).toBe(t2);
    await user.keyboard(' ');
    expect(t2!.getAttribute('aria-expanded')).toBe('false');
  });

  it('salida colada con <img onerror> se ve como texto y no crea nodos', async () => {
    const attempt = makeAttempt(bank);
    setup({ attempt, analysis: storedFor(attempt, bank) });
    renderPlan(attempt);
    await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    const evil = '<img src=x onerror="window.__pwned=1">';
    act(() => {
      const a = useAnalysis.getState().analyses.byAttempt[attempt.id]!;
      useAnalysis.setState({ analyses: { schemaVersion: 1, byAttempt: { [attempt.id]: { ...a, output: { ...a.output, summary: evil } } } } });
    });
    expect(await screen.findByText(evil)).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('botones de práctica: URLs de la sección 10 y filterQuestions devuelve exactamente esos ids', async () => {
    const attempt = makeAttempt(bank);
    const analysis = storedFor(attempt, bank);
    setup({ attempt, analysis });
    const user = userEvent.setup();
    renderPlan(attempt);
    await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    const review = screen.getAllByRole('link', { name: 'Repasar mis errores (3)' })[0]!;
    expect(review.getAttribute('href')).toBe(`/practica/gor-cap1-0002?lista=intento%3A${attempt.id}`);
    const practice = screen.getAllByRole('link', { name: `Practicar estos temas (${analysis.derived.practiceIds.length})` })[0]!;
    expect(practice.getAttribute('href')).toMatch(new RegExp(`^/practica/gor-cap1-\\d{4}\\?lista=plan%3A${attempt.id}$`));
    const ctx = { questions: bank.questions, progress: { schemaVersion: 1 as const, bankVersion: '', questions: {} }, attempts: { schemaVersion: 1 as const, attempts: [attempt] }, analyses: { schemaVersion: 1 as const, byAttempt: { [attempt.id]: analysis } } };
    expect(filterQuestions(ctx, { list: `plan:${attempt.id}` }).map((q) => q.id).sort()).toEqual([...analysis.derived.practiceIds].sort());
    expect(filterQuestions(ctx, { list: `plan:${attempt.id}:c1` }).map((q) => q.id).sort()).toEqual([...analysis.derived.practiceByConcept.c1!].sort());
    expect(filterQuestions(ctx, { list: `attempt:${attempt.id}` }).map((q) => q.id)).toEqual(['gor-cap1-0002', 'gor-cap1-0003', 'msr-a052']);
    await user.click(practice);
    const art = await screen.findByRole('article');
    expect(analysis.derived.practiceIds).toContain(art.getAttribute('data-question-id'));
    expect(screen.getByRole('heading', { level: 1, name: 'Práctica · Temas de tu plan de estudio' })).toBeInTheDocument();
    expect(within(art).getByText(`1 / ${analysis.derived.practiceIds.length}`)).toBeInTheDocument();
    // la aclaración de la lista del plan pasó a "Ver detalle" (PLAN-LAYOUT 5.1)
    await user.click(within(art).getByRole('button', { name: /Ver detalle/ }));
    expect(within(await screen.findByRole('dialog')).getByText(es.ai.practiceNote)).toBeInTheDocument();
  });

  it('"Repasar mis errores" abre exactamente las incorrectas y omitidas', async () => {
    const attempt = makeAttempt(bank);
    setup({ attempt, analysis: storedFor(attempt, bank) });
    const user = userEvent.setup();
    renderPlan(attempt);
    await user.click((await screen.findAllByRole('link', { name: 'Repasar mis errores (3)' }))[0]!);
    const art = await screen.findByRole('article');
    expect(art).toHaveAttribute('data-question-id', 'gor-cap1-0002');
    expect(within(art).getByText('1 / 3')).toBeInTheDocument();
  });

  it('sin candidatas (sin capítulo ni objetivo SY0-701) el botón "Practicar estos temas" no existe', async () => {
    const chapters = chapterMap(bank.questions);
    const noTheme = bank.questions.find((q) => q.group === 'sim' && chapters.get(q.id) === null)!.id;
    const attempt = makeAttempt(bank, [
      [noTheme, 'incorrect'],
      ['gor-cap1-0001', 'correct'],
    ]);
    const out: ModelOutput = { ...validOutput(), concepts: [{ ...validOutput().concepts[0]!, questionIds: [noTheme], questionNotes: [{ questionId: noTheme, note: 'n' }], confusions: [] }], unassigned: [], strengths: [] };
    setup({ attempt, analysis: storedFor(attempt, bank, out) });
    renderPlan(attempt);
    await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    expect(screen.queryByRole('link', { name: /Practicar estos temas/ })).toBeNull();
    expect(screen.getAllByText('No hay otras preguntas del banco asociadas a estos temas.').length).toBeGreaterThan(0);
  });

  it('errores de Messer (extracto y libro completo): "Practicar estos temas" ofrece preguntas del libro completo con el mismo objetivo SY0-701', async () => {
    const attempt = makeAttempt(bank, [
      ['msr-a052', 'incorrect'],
      ['msf-a014', 'incorrect'],
      ['gor-cap1-0001', 'correct'],
    ]);
    const out: ModelOutput = {
      ...validOutput(),
      concepts: [{ ...validOutput().concepts[0]!, questionIds: ['msr-a052', 'msf-a014'], questionNotes: [{ questionId: 'msr-a052', note: 'n' }, { questionId: 'msf-a014', note: 'n' }], confusions: [] }],
      unassigned: [],
      strengths: [],
    };
    const stored = storedFor(attempt, bank, out);
    setup({ attempt, analysis: stored });
    renderPlan(attempt);
    await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    expect(screen.getAllByRole('link', { name: /Practicar estos temas/ }).length).toBeGreaterThan(0);
    expect(stored.derived.practiceIds.length).toBeGreaterThan(0);
    expect(stored.derived.practiceIds.every((id) => bank.indexes.byId.get(id)!.doc === 'messerfull')).toBe(true);
  });

  it('con proveedor simulado aparece el rótulo de simulación', async () => {
    const attempt = makeAttempt(bank);
    setup({ attempt, analysis: storedFor(attempt, bank, undefined, { provider: 'mock', model: 'mock' }) });
    renderPlan(attempt);
    expect(await screen.findByText('Análisis simulado para pruebas — no lo generó una IA')).toBeInTheDocument();
  });

  it('sin conceptos: "no encontró un patrón" y la lista sin agrupar', async () => {
    const attempt = makeAttempt(bank);
    const out: ModelOutput = { ...validOutput(), concepts: [], unassigned: ['gor-cap1-0002', 'gor-cap1-0003', 'msr-a052'], strengths: [] };
    setup({ attempt, analysis: storedFor(attempt, bank, out) });
    renderPlan(attempt);
    expect(await screen.findByRole('heading', { name: 'La IA no encontró un patrón común en tus errores.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Otros errores sin agrupar (3)' })).toBeInTheDocument();
  });

  it('Historial de Repaso suma "Ver plan" en intentos con análisis', async () => {
    const attempt = makeAttempt(bank);
    setup({ attempt, analysis: storedFor(attempt, bank) });
    renderApp('/repaso?tab=historial', { skipReset: true });
    expect(await screen.findByRole('link', { name: /Ver plan de estudio del/ })).toHaveAttribute('href', `/examen/resultado/${attempt.id}/plan`);
  });

  it('borrar intentos poda los análisis', async () => {
    const attempt = makeAttempt(bank);
    setup({ attempt, analysis: storedFor(attempt, bank) });
    renderPlan(attempt);
    await screen.findByRole('heading', { level: 2, name: 'Resumen' });
    act(() => useExam.getState().clearAll());
    expect(useAnalysis.getState().analyses.byAttempt).toEqual({});
  });
});

describe('studyPlanModel', () => {
  it('banco anterior con hashes iguales: chip y regenerar; con un hash cambiado: solo lectura y fuera de la práctica', () => {
    const attempt = makeAttempt(bank);
    const a = storedFor(attempt, bank, undefined, { bankVersion: 'viejo' });
    const v = buildPlanView(a, attempt, bank, '2026-11-a');
    expect(v.oldBank).toBe(true);
    expect(v.readOnly).toBe(false);
    const changed = structuredClone(attempt);
    changed.items[1]!.contentHash = 'distinto0';
    const v2 = buildPlanView(a, changed, bank, '2026-11-a');
    expect(v2.readOnly).toBe(true);
    expect(v2.groups[0]!.concepts[0]!.evidence.find((e) => e.id === 'gor-cap1-0002')!.changed).toBe(true);
  });

  it('versión de prompt anterior y recorte informado', () => {
    const attempt = makeAttempt(bank);
    const a = storedFor(attempt, bank, undefined, { promptVersion: '2025-01-a', coverage: { failed: 95, failedAnalyzed: 60, correctSent: 10, omitted: 1, notScored: 2 } });
    const v = buildPlanView(a, attempt, bank, '2026-11-a');
    expect(v.olderPrompt).toBe(true);
    expect(v.notDetailed).toBe(35);
  });

  it('con mayoría omitida lo marca; los conteos salen del intento', () => {
    const attempt = makeAttempt(bank, [...BASIC.slice(0, 2), ['gor-cap1-0004', 'omitted'], ['gor-cap1-0005', 'omitted'], ['gor-cap1-0006', 'omitted'], ['gor-cap1-0003', 'omitted']]);
    const v = buildPlanView(storedFor(attempt, bank), attempt, bank, null);
    expect(v.mostlyOmitted).toBe(true);
    expect(v.counts).toMatchObject({ correct: 1, incorrect: 1, omitted: 4 });
  });
});
