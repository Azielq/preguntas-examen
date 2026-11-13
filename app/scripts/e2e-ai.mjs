// Verificación en navegador del análisis con IA (PLAN-IA 12.2) con el proveedor simulado.
// Uso:
//   npm run dev                                   (mock automático, sin variables)          → E2E_AI_URL (por defecto http://localhost:5173/)
//   opcional: AI_PROVIDER=anthropic sin clave     (otro puerto)                             → E2E_NOKEY_URL
//   opcional: npm run build && npx vite preview   (sin funciones: "no disponible")          → E2E_PREVIEW_URL
//   node scripts/e2e-ai.mjs
// Capturas en e2e-output/ai-*.png.
import { createRunner } from './lib/e2e-utils.mjs';

const BASE = process.env.E2E_AI_URL ?? 'http://localhost:5173/';
const NOKEY = process.env.E2E_NOKEY_URL;
const PREVIEW = process.env.E2E_PREVIEW_URL;
const OUT = 'e2e-output';
const runner = await createRunner({ base: BASE, out: OUT });
const { check, shot, noHScroll, axeCheck } = runner;

async function newPage(viewport, opts = {}) {
  const r = await runner.newPage(viewport, opts);
  const analyze = [];
  r.page.on('request', (q) => {
    if (q.url().includes('/api/analyze')) analyze.push(q);
  });
  return { ...r, analyze };
}

async function go(page, base, hash) {
  await page.goto(`${base}#${hash}`);
  await page.waitForSelector('main h1', { state: 'attached' });
}

/** Rinde un examen de 10 (por defecto solo Gorgotsias): responde 6 con la opción 1 y deja 4 sin responder. */
async function takeExam(page, base, { tap = false, doc = 'gorgotsias' } = {}) {
  await go(page, base, '/examen');
  // un solo documento: se destildan los demás (clic programático: la barra inferior puede tapar las casillas en móvil)
  for (const d of ['gorgotsias', 'messer', 'messerfull']) await page.locator(`input[name=source][value=${d}]`).evaluate((el, on) => el.checked !== on && el.click(), d === doc);
  await page.getByRole('radio', { name: '10' }).evaluate((el) => el.checked || el.click());
  const start = page.getByRole('button', { name: /Empezar examen/ });
  if (tap) await start.tap();
  else await start.click();
  await page.waitForSelector('article');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
  }
  await page.getByRole('button', { name: 'Finalizar' }).first().click();
  await page.getByRole('button', { name: 'Finalizar examen' }).click();
  await page.waitForSelector('text=Resultado del examen');
  // la tarjeta pasa por "Comprobando…" mientras responde /api/ai-status
  await page.waitForFunction(() => !document.querySelector('section[aria-labelledby="ai-entry-h"] [aria-busy="true"]'), null, { timeout: 30000 });
  return page.url().split('#')[1];
}

const withScenario = (page, scenario) =>
  page.route('**/api/analyze', (route) => route.continue({ headers: { ...route.request().headers(), 'x-mock-scenario': scenario } }));

// ---------------- Escritorio 1280: flujo completo ----------------
{
  const { ctx, page, analyze } = await newPage({ width: 1280, height: 900 });
  const resultPath = await takeExam(page, BASE);
  const entryText = await page.locator('section[aria-labelledby="ai-entry-h"]').textContent();
  check('Resultado: tarjeta "Análisis con IA" con aviso de envío a Anthropic y botón', entryText.includes('Se envían a Anthropic') && (await page.getByRole('button', { name: 'Analizar mis resultados con IA' }).count()) === 1);
  check('Resultado: la nota y la lista convencional siguen visibles', (await page.textContent('main')).includes('correctas') && (await page.getByRole('link', { name: 'Revisar todas' }).count()) === 1);
  await shot(page, 'ai-d01-resultado-entrada');
  await axeCheck(page, 'Resultado con tarjeta IA (claro)');

  await page.getByRole('button', { name: 'Analizar mis resultados con IA' }).click();
  await page.waitForSelector('h2:has-text("Resumen")');
  check('Plan: título "Tu plan de estudio" y document.title', (await page.textContent('main h1')) === 'Tu plan de estudio' && (await page.title()).startsWith('Tu plan de estudio'));
  check('Plan: rótulo de análisis simulado visible', (await page.textContent('main')).includes('Análisis simulado para pruebas — no lo generó una IA'));
  check('Plan: foco en el encabezado "Resumen" al terminar', await page.evaluate(() => document.activeElement?.textContent === 'Resumen'));
  check('Plan: exactamente 1 pedido a /api/analyze', analyze.length === 1, String(analyze.length));
  const reqBody = analyze[0].postData();
  check('El pedido no lleva texto de preguntas, id de intento ni fechas', !/stem|options|explanation|startedAt|finishedAt|ex-/.test(reqBody) && reqBody.includes('"hash"'));
  await shot(page, 'ai-d02-plan-claro');
  await axeCheck(page, 'Plan (claro)');
  const aiBlocks = await page.locator('[data-origin="ai"]').count();
  const pdfInsideAi = await page.locator('[data-origin="ai"] section[data-origin="pdf"]').count();
  check('Contenido IA diferenciado y ningún bloque del PDF dentro de uno de IA', aiBlocks > 3 && pdfInsideAi === 0, `${aiBlocks} bloques IA`);

  // acordeón
  const toggles = page.locator('article[data-concept-id] h3 > button');
  const n = await toggles.count();
  if (n > 1) {
    const second = toggles.nth(1);
    const before = await second.getAttribute('aria-expanded');
    await second.focus();
    await page.keyboard.press('Enter');
    check('Tarjeta: Enter alterna aria-expanded y muestra el panel', before === 'false' && (await second.getAttribute('aria-expanded')) === 'true');
  } else check('Tarjeta: hay al menos una tarjeta de concepto', n >= 1, String(n));
  await page.getByRole('button', { name: 'Abrir todas' }).click().catch(() => {});
  await shot(page, 'ai-d03-plan-tarjetas-abiertas');

  // "Practicar estos temas"
  const practice = page.getByRole('link', { name: /^Practicar estos temas/ }).first();
  if (await practice.count()) {
    const label = await practice.textContent();
    await practice.click();
    await page.waitForSelector('article[data-question-id]');
    const h1 = await page.textContent('main h1');
    const pos = await page.locator('article[data-question-id]').textContent();
    const total = label.match(/\((\d+)\)/)[1];
    check('"Practicar estos temas" abre Práctica con la lista del plan', h1.includes('Temas de tu plan de estudio') && pos.includes(`1 / ${total}`), `${h1} · total ${total}`);
    await page.locator('article [data-action="detail"]').first().click();
    await page.waitForSelector('dialog[open][data-sheet="detail"]');
    check('La práctica del plan aclara que la selección es de la app (en "Ver detalle")', (await page.textContent('dialog[open]')).includes('La selección la hace la app, no la IA.'));
    await page.keyboard.press('Escape');
    await shot(page, 'ai-d04-practicar-temas');
    await page.goBack();
    await page.waitForSelector('h2:has-text("Resumen")');
  } else check('"Practicar estos temas" visible (hay errores de capítulo)', false);

  // "Repasar mis errores"
  const reviewLink = page.getByRole('link', { name: /^Repasar mis errores/ }).first();
  const rlabel = await reviewLink.textContent();
  await reviewLink.click();
  await page.waitForSelector('article[data-question-id]');
  const rTotal = rlabel.match(/\((\d+)\)/)[1];
  check('"Repasar mis errores" abre las incorrectas y omitidas del intento', (await page.textContent('main h1')).includes('Incorrectas y omitidas') && (await page.locator('article[data-question-id]').textContent()).includes(`1 / ${rTotal}`), rlabel);
  await page.goBack();
  await page.waitForSelector('h2:has-text("Resumen")');

  // Recargar: sin nuevo pedido
  const planUrl = page.url();
  await page.reload();
  await page.waitForSelector('h2:has-text("Resumen")');
  check('Tras recargar el plan se reabre sin un nuevo pedido', analyze.length === 1 && page.url() === planUrl, `${analyze.length} pedidos`);
  await go(page, BASE, resultPath);
  check('Resultado con análisis guardado: "Ver tu plan de estudio"', (await page.getByRole('link', { name: 'Ver tu plan de estudio' }).count()) === 1);
  await go(page, BASE, '/repaso?tab=historial');
  check('Historial: enlace "Ver plan"', (await page.getByRole('link', { name: /Ver plan de estudio del/ }).count()) === 1);

  // Exportar incluye el análisis y no el token
  const exported = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('secplus:v1:')));
  check('Clave propia secplus:v1:analyses en localStorage', exported.includes('secplus:v1:analyses'), exported.join(', '));

  // Intento B: lento + cancelar, error + reintentar
  const resultB = await takeExam(page, BASE);
  await withScenario(page, 'slow');
  await page.getByRole('button', { name: 'Analizar mis resultados con IA' }).click();
  await page.waitForSelector('text=Suele tardar entre 20 segundos y 2 minutos');
  check('Cargando: skeleton con aria-busy, tiempo transcurrido y Cancelar', (await page.locator('[aria-busy="true"]').count()) > 0 && (await page.getByRole('button', { name: 'Cancelar' }).count()) === 1);
  await shot(page, 'ai-d05-cargando', false);
  await axeCheck(page, 'Plan cargando');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.waitForSelector('button:has-text("Analizar mis resultados con IA")');
  check('Cancelar vuelve a idle y el foco al botón Analizar', await page.evaluate(() => document.activeElement?.textContent?.includes('Analizar mis resultados con IA')));
  await page.unroute('**/api/analyze');
  await withScenario(page, 'upstream_error');
  await page.getByRole('button', { name: 'Analizar mis resultados con IA' }).click();
  await page.waitForSelector('[role="alert"]');
  const alertText = await page.locator('[role="alert"]').first().textContent();
  check('Error simulado: role=alert, mensaje de 3.4 y Reintentar', alertText.includes('El servicio de IA no respondió') && alertText.includes('Tu nota y la revisión de respuestas no cambian') && (await page.getByRole('button', { name: 'Reintentar' }).count()) === 1);
  await shot(page, 'ai-d06-error', false);
  await axeCheck(page, 'Plan con error');
  await page.unroute('**/api/analyze');
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await page.waitForSelector('h2:has-text("Resumen")');
  check('Reintentar tras el error genera el plan', true);
  await go(page, BASE, resultB);
  await go(page, BASE, '/ajustes#ia');
  check('Ajustes: sección "Análisis con IA" con estado real', (await page.locator('#ia').textContent()).includes('proveedor simulado'));
  await shot(page, 'ai-d07-ajustes-ia', false);

  // Tema oscuro
  await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();
  await page.goto(planUrl);
  await page.waitForSelector('h2:has-text("Resumen")');
  await page.getByRole('button', { name: 'Abrir todas' }).click().catch(() => {});
  await shot(page, 'ai-d08-plan-oscuro');
  await axeCheck(page, 'Plan (oscuro)');
  await go(page, BASE, resultPath);
  await shot(page, 'ai-d09-resultado-oscuro');
  await axeCheck(page, 'Resultado con tarjeta IA (oscuro)');
  for (const w of [320, 768, 1100]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(planUrl);
    await page.waitForSelector('h2:has-text("Resumen")');
    check(`Plan sin scroll horizontal a ${w}px`, await noHScroll(page));
  }
  await ctx.close();
}

// ---------------- Libro completo de Messer: análisis con el proveedor simulado ----------------
{
  const { ctx, page, analyze } = await newPage({ width: 1280, height: 900 });
  await go(page, BASE, '/');
  const status = await page.evaluate(async (base) => (await fetch(`${base}api/ai-status`)).json(), BASE);
  const manifest = await page.evaluate(async (base) => (await fetch(`${base}bank/manifest.json`)).json(), BASE);
  check('El servidor usa la copia actualizada del banco (ai-status.bankVersion = manifest)', status.bankVersion === manifest.bankVersion && manifest.bankVersion === '758483f7ae', `${status.bankVersion} / ${manifest.bankVersion}`);
  await takeExam(page, BASE, { doc: 'messerfull' });
  await page.getByRole('button', { name: 'Analizar mis resultados con IA' }).click();
  await page.waitForSelector('h2:has-text("Resumen")');
  const body = analyze[0] ? JSON.parse(analyze[0].postData()) : null;
  const ids = body ? body.attempt.items.map((i) => i.id) : [];
  check('Messer libro completo: el pedido solo lleva ids msf-*, hashes y letras', ids.length === 10 && ids.every((x) => x.startsWith('msf-')) && !/stem|options|explanation/.test(analyze[0].postData()), ids.slice(0, 3).join(', '));
  const resp = await analyze[0].response();
  check('Messer libro completo: el servidor respondió 200 con el banco nuevo', resp?.status() === 200, String(resp?.status()));
  check('Messer libro completo: plan generado (rótulo de simulación) con "Practicar estos temas" por objetivo SY0-701', (await page.textContent('main')).includes('Análisis simulado para pruebas') && (await page.getByRole('link', { name: /^Practicar estos temas/ }).count()) > 0);
  await shot(page, 'ai-d10-plan-messer-libro');
  await page.getByRole('link', { name: /^Practicar estos temas/ }).first().click();
  await page.waitForSelector('article[data-question-id]');
  const qid = await page.getAttribute('article[data-question-id]', 'data-question-id');
  check('"Practicar estos temas" (libro completo) abre preguntas del libro completo', qid.startsWith('msf-'), qid);
  await ctx.close();
}

// el examen anterior con viñetas, código y múltiples: el servidor reconstruye y corrige con el mock
{
  const { ctx, page, analyze } = await newPage({ width: 1280, height: 900 });
  await page.goto(BASE);
  await page.waitForSelector('main h1', { state: 'attached' });
  const res = await page.evaluate(async (base) => {
    const m = await (await fetch(`${base}bank/manifest.json`)).json();
    const core = await (await fetch(`${base}bank/${m.files.core}`)).json();
    const by = Object.fromEntries(core.map((q) => [q.id, q]));
    const pick = ['msf-a014', 'msf-c054', 'msf-a015', 'msf-b039'];
    const items = pick.map((id, i) => {
      const q = by[id];
      const wrong = q.options.map((o) => o.letter).filter((l) => !q.correct.includes(l)).slice(0, q.correct.length);
      return i === 3 ? { id, hash: q.contentHash, selected: q.correct, result: 'correct' } : { id, hash: q.contentHash, selected: wrong, result: 'incorrect' };
    });
    const r = await fetch(`${base}api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, bankVersion: m.bankVersion, attempt: { items, notScoredCount: 0 }, history: { questions: [], chapters: [] } }),
    });
    return { status: r.status, body: await r.json() };
  }, BASE);
  const failedIds = res.body?.output ? [...res.body.output.concepts.flatMap((k) => k.questionIds), ...res.body.output.unassigned] : [];
  check('POST directo con msf-a014 (Select THREE, viñetas), msf-c054 (código, múltiple) y msf-a015 (código): 200 y las tres falladas analizadas', res.status === 200 && ['msf-a014', 'msf-c054', 'msf-a015'].every((x) => failedIds.includes(x)), `${res.status} ${failedIds.join(', ')}`);
  void analyze;
  await ctx.close();
}

// ---------------- Móvil 390 ----------------
{
  const { ctx, page } = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await takeExam(page, BASE, { tap: true });
  await shot(page, 'ai-m01-resultado');
  check('Móvil: resultado sin scroll horizontal', await noHScroll(page));
  await page.getByRole('button', { name: 'Analizar mis resultados con IA' }).tap();
  await page.waitForSelector('h2:has-text("Resumen")');
  await shot(page, 'ai-m02-plan-claro');
  check('Móvil: plan sin scroll horizontal', await noHScroll(page));
  const btnH = await page.getByRole('link', { name: /^Repasar mis errores/ }).first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
  check('Móvil: botones principales ≥ 44 px de alto', btnH >= 44, `${btnH}px`);
  await axeCheck(page, 'Plan móvil (claro)');
  await page.getByRole('button', { name: 'Abrir todas' }).tap().catch(() => {});
  await shot(page, 'ai-m03-plan-tarjetas');
  await page.evaluate(() => {
    localStorage.setItem('secplus:v1:prefs', JSON.stringify({ ...JSON.parse(localStorage.getItem('secplus:v1:prefs') ?? '{}'), theme: 'dark', textSize: 'normal', singleKeyShortcuts: true, timerHidden: false }));
  });
  await page.reload();
  await page.waitForSelector('h2:has-text("Resumen")');
  await shot(page, 'ai-m04-plan-oscuro');
  await axeCheck(page, 'Plan móvil (oscuro)');
  await page.setViewportSize({ width: 320, height: 800 });
  check('Móvil 320: plan sin scroll horizontal', await noHScroll(page));
  await ctx.close();
}

// ---------------- Sin clave (AI_PROVIDER=anthropic sin ANTHROPIC_API_KEY) ----------------
if (NOKEY) {
  const { ctx, page, analyze } = await newPage({ width: 1280, height: 900 });
  await takeExam(page, NOKEY);
  const t = await page.locator('section[aria-labelledby="ai-entry-h"]').textContent();
  check('Sin clave: "no está configurado en este despliegue" y sin botón', t.includes('no está configurado en este despliegue') && (await page.getByRole('button', { name: 'Analizar mis resultados con IA' }).count()) === 0);
  await shot(page, 'ai-x01-sin-clave', false);
  const status = await page.evaluate(async () => (await fetch('api/ai-status')).json());
  check('Sin clave: ai-status available=false reason=no_key, sin secretos', status.available === false && status.reason === 'no_key' && !JSON.stringify(status).includes('sk-'), JSON.stringify(status));
  const post = await page.evaluate(async () => {
    const r = await fetch('api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return { status: r.status, body: await r.json() };
  });
  check('Sin clave: POST /api/analyze → 503 unavailable', post.status === 503 && post.body.error.code === 'unavailable', JSON.stringify(post));
  check('Sin clave: la UI no llamó a /api/analyze', analyze.length === 1, String(analyze.length));
  await ctx.close();
}

// ---------------- Hosting sin funciones (vite preview) ----------------
if (PREVIEW) {
  const { ctx, page } = await newPage({ width: 1280, height: 900 });
  await takeExam(page, PREVIEW);
  const t = await page.locator('section[aria-labelledby="ai-entry-h"]').textContent();
  check('vite preview (sin funciones): "no está disponible en esta instalación"', t.includes('no está disponible en esta instalación'));
  check('vite preview: el resultado convencional funciona', (await page.getByRole('link', { name: 'Revisar todas' }).count()) === 1);
  await shot(page, 'ai-x02-sin-funciones', false);
  await ctx.close();
}

const failed = await runner.finish((c) => !/status of (404|502|503)/.test(c));
process.exit(failed ? 1 : 0);
