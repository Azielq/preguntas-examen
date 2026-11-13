// Verificación de distribución (PLAN-LAYOUT 15): matriz de 21 ventanas en Chromium headless contra `vite preview`.
// Uso: npm run build && npx vite preview --port 4173 (otra terminal) → npm run e2e:layout
//   E2E_LAYOUT_ONLY=M4,D2   limita las celdas;  E2E_LAYOUT_BANK=1   mide además el banco real completo (1366×650 y 390×844).
// El contenido largo se inyecta interceptando la red (src/test/layoutFixtures.ts): nada de esto entra al build.
import { mkdirSync, writeFileSync } from 'node:fs';
import { layoutFixtures } from '../src/test/layoutFixtures.ts';
import { createRunner } from './lib/e2e-utils.mjs';

const BASE = process.env.E2E_URL ?? 'http://localhost:4173/';
const OUT = 'e2e-output/layout';
mkdirSync(OUT, { recursive: true });
const { check, newPage, go, shot, axeCheck, finish } = await createRunner({ base: BASE, out: OUT });

const FIX = layoutFixtures();
const FIX_BY_ID = Object.fromEntries(Object.values(FIX).map((f) => [f.id, f]));

// [id, ancho, alto, escala, modo esperado, extra]
const MATRIX = [
  ['M1', 320, 568, 1, 'fit', { mobile: true }],
  ['M2', 360, 560, 1, 'fit', { mobile: true }],
  ['M3', 375, 553, 1, 'fit', { mobile: true }],
  ['M4', 390, 844, 1, 'fit', { mobile: true }],
  ['M5', 430, 932, 1, 'fit', { mobile: true }],
  ['L1', 667, 375, 1, 'fit-wide', { mobile: true }],
  ['L2', 844, 390, 1, 'fit-wide', { mobile: true }],
  ['L3', 932, 430, 1, 'fit-wide', { mobile: true }],
  ['T1', 768, 1024, 1, 'fit', {}],
  ['T2', 1024, 768, 1, 'fit', {}],
  ['D1', 1280, 720, 1, 'fit', {}],
  ['D2', 1366, 650, 1, 'fit', {}],
  ['D3', 1440, 900, 1, 'fit', {}],
  ['D4', 1920, 1080, 1, 'fit', {}],
  ['H1', 1280, 400, 1, 'fit-wide', {}],
  ['H2', 1024, 320, 1, 'fit-wide', {}],
  ['H3', 360, 420, 1, 'flow', {}],
  ['Z200', 640, 360, 2, 'fit-wide', {}],
  ['Z300', 427, 240, 3, 'flow', {}],
  ['Z400', 320, 256, 4, 'flow', {}],
  ['F200', 390, 844, 1, 'flow', { font200: true }],
];
const FULL_RUN = new Set(['M1', 'M4', 'L2', 'D1', 'H1', 'Z400']); // recorridos † (PLAN-LAYOUT 15.3)
const only = process.env.E2E_LAYOUT_ONLY ? new Set(process.env.E2E_LAYOUT_ONLY.split(',')) : null;

/** Intercepta core y explicaciones: sustituye el contenido de los ids de prueba por los fixtures sintéticos. */
async function injectFixtures(ctx) {
  await ctx.route('**/bank/core.*.json', async (route) => {
    const res = await route.fetch();
    const core = await res.json();
    for (const q of core) {
      const f = FIX_BY_ID[q.id];
      if (!f) continue;
      q.stem = f.stem;
      q.options = f.options;
      q.selectionType = f.selectionType;
      q.correct = f.correct;
      if (f.review) {
        q.review = f.review;
        q.answerStatus = 'pending';
        q.scorable = false;
      }
    }
    await route.fulfill({ response: res, json: core });
  });
  await ctx.route('**/bank/explanations.*.json', async (route) => {
    const res = await route.fetch();
    const ex = await res.json();
    for (const f of Object.values(FIX)) {
      ex[f.id] = f.explanation ?? { origin: 'pdf', language: 'en', text: f.stem[0].text, perOption: {} };
    }
    await route.fulfill({ response: res, json: ex });
  });
}

/** Verificaciones 1–12 de assertLayout (PLAN-LAYOUT 15.3). Devuelve la lista de fallas. */
async function assertLayout(page, mode, { factor = 1, fixture = null, safe = null } = {}) {
  return page.evaluate(
    ({ mode, factor, fixture, safe }) => {
      const fails = [];
      const W = innerWidth;
      const H = innerHeight;
      const de = document.documentElement;
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only');
      };
      const R = (el) => el.getBoundingClientRect();
      const inter = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      // 1 modo
      if (de.dataset.qlayout !== mode) fails.push(`1 modo ${de.dataset.qlayout} ≠ ${mode}`);
      // 2 sin scroll horizontal
      if (de.scrollWidth > de.clientWidth) fails.push(`2 scroll horizontal ${de.scrollWidth}>${de.clientWidth}`);
      // 3 sin scroll vertical (fit*)
      if (mode !== 'flow') {
        if (de.scrollHeight > H + 1) fails.push(`3 scrollHeight ${de.scrollHeight}>${H}`);
        scrollTo(0, 9999);
        if (scrollY !== 0) fails.push(`3 scrollY ${scrollY}`);
        scrollTo(0, 0);
      }
      const bar = document.querySelector('[data-qregion="actions"]');
      const area = document.querySelector('[data-qregion="area"]');
      const status = document.querySelector('[data-qregion="status"]');
      const header = document.querySelector('[data-qregion="header"]');
      const barBtns = bar ? [...bar.querySelectorAll('button, a[href]')].filter(vis) : [];
      // 4 botones dentro de la ventana
      for (const b of barBtns) {
        if (mode === 'flow') b.scrollIntoView({ block: 'nearest' });
        const r = R(b);
        if (r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5) fails.push(`4 botón fuera: ${b.textContent.trim()} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      if (mode === 'flow') scrollTo(0, 0);
      // 5 superposiciones
      const ctrls = [...document.querySelectorAll('[data-qregion="actions"] button, [data-qregion="actions"] a[href], [data-qregion="status"] button, [data-qregion="header"] button, [data-qregion="header"] a[href]')].filter(vis);
      for (let i = 0; i < ctrls.length; i++)
        for (let j = i + 1; j < ctrls.length; j++) {
          if (ctrls[i].contains(ctrls[j]) || ctrls[j].contains(ctrls[i])) continue;
          if (inter(R(ctrls[i]), R(ctrls[j]))) fails.push(`5 se superponen: "${ctrls[i].textContent.trim()}" y "${ctrls[j].textContent.trim()}"`);
        }
      if (area && mode !== 'flow') {
        const ra = R(area);
        for (const [n, el] of [['barra', bar], ['franja', status], ['encabezado', header]]) if (el && vis(el) && inter(R(el), ra)) fails.push(`5 ${n} ∩ área`);
      }
      // 6 objetivos táctiles ≥ 44 × 44
      const targets = [...document.querySelectorAll('[data-qregion="header"] :is(button, a[href], select), [data-qregion="status"] :is(button, a[href]), [data-qregion="actions"] :is(button, a[href]), dialog[open] [data-dialog-head] button')].filter(vis);
      for (const t of targets) {
        const r = R(t);
        if (r.width < 43.5 || r.height < 43.5) fails.push(`6 objetivo chico ${Math.round(r.width)}×${Math.round(r.height)}: ${t.getAttribute('aria-label') ?? t.textContent.trim()}`);
      }
      // 7 texto de controles sin cortar
      for (const t of [...document.querySelectorAll('[data-qregion] button, [data-qregion] [data-badge], [data-qregion] .chip')].filter(vis)) {
        if (t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1) fails.push(`7 texto cortado: ${t.textContent.trim().slice(0, 40)} (${t.scrollWidth}/${t.clientWidth}, ${t.scrollHeight}/${t.clientHeight})`);
      }
      // 8 nada fuera de los márgenes (salvo pre, visor de imagen y tablas)
      const main = document.querySelector('main');
      let out8 = 0;
      for (const el of main.querySelectorAll('*')) {
        if (el.closest('pre, [data-zoom-viewer], .table-wrap, dialog:not([open])')) continue;
        if (!vis(el)) continue;
        const r = R(el);
        if (r.left < -0.5 || r.right > W + 0.5) {
          if (out8++ < 3) fails.push(`8 fuera de márgenes: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.left)}–${Math.round(r.right)}`);
        }
      }
      // 9 tipografía mínima
      const px = (el) => parseFloat(getComputedStyle(el).fontSize);
      for (const p of document.querySelectorAll('[data-stem] > p')) if (px(p) < 16 * factor - 0.1) fails.push(`9 enunciado ${px(p)}px`);
      for (const o of document.querySelectorAll('[data-letter] [lang="en"]')) if (px(o) < 16 * factor - 0.1) fails.push(`9 opción ${px(o)}px`);
      for (const b of barBtns) if (px(b) < 15 * factor - 0.1) fails.push(`9 botón de barra ${px(b)}px`);
      // 10 texto literal
      if (fixture) {
        const blocks = [...document.querySelectorAll('[data-stem] > *')].map((e) => e.textContent);
        if (JSON.stringify(blocks) !== JSON.stringify(fixture.stem.map((b) => b.text))) fails.push('10 enunciado distinto del fixture');
        const opts = [...document.querySelectorAll('[data-letter] [lang="en"]')].map((e) => e.textContent);
        if (JSON.stringify(opts) !== JSON.stringify(fixture.options.map((o) => o.text))) fails.push('10 opciones distintas del fixture');
      }
      // 11 sin recortes prohibidos dentro del área
      if (area)
        for (const el of area.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) fails.push(`11 recorte en ${el.tagName}`);
        }
      // 12 coherencia del ajuste
      if (area) {
        const fit = area.dataset.fit;
        const fullBtn = document.querySelector('[data-action="full"]');
        const more = document.querySelector('[data-qregion="more"]');
        if (fit === 'complete') {
          if (document.querySelector('[data-qscreen]')?.dataset.view !== 'full' && fullBtn) fails.push('12 complete con botón "Ver pregunta completa"');
          if (mode !== 'flow' && area.scrollHeight > area.clientHeight + 2) fails.push(`12 complete pero el área desborda ${area.scrollHeight}/${area.clientHeight}`);
        } else if (fit === 'stem-scroll') {
          const vp = document.querySelector('[data-stem-viewport]');
          const lh = parseFloat(getComputedStyle(vp.querySelector('p, pre') ?? vp).lineHeight);
          const h = vp.clientHeight;
          if (Math.abs(h / lh - Math.round(h / lh)) * lh > 1.01) fails.push(`12 visor no múltiplo de línea ${h}/${lh}`);
          if (Math.round(h / lh) < 5) fails.push(`12 visor con menos de 5 líneas (${h}/${lh})`);
          if (!fullBtn || !vis(fullBtn)) fails.push('12 stem-scroll sin botón visible');
        } else if (fit === 'area-scroll') {
          if (area.scrollHeight <= area.clientHeight) fails.push('12 area-scroll sin desborde');
          if (!(more && vis(more)) && !(fullBtn && vis(fullBtn))) fails.push('12 area-scroll sin fila "continúa" ni botón');
        }
      }
      // márgenes seguros simulados
      if (safe) {
        for (const t of [...document.querySelectorAll('[data-qregion="actions"] :is(button, a[href]), [data-qregion="header"] :is(button, a[href])')].filter(vis)) {
          const r = R(t);
          if (r.left < safe.side - 0.5 || r.right > W - safe.side + 0.5 || r.bottom > H - safe.bottom + 0.5) fails.push(`seguro: ${t.textContent.trim() || t.getAttribute('aria-label')} en la franja segura`);
        }
      }
      return fails;
    },
    { mode, factor, fixture, safe },
  );
}

async function openPractice(page, id, extra = '') {
  await go(page, `/practica/${id}${extra}`, `article[data-question-id="${id}"]`);
  await page.waitForTimeout(250);
}

async function report(cell, label, fails) {
  check(`${cell} · ${label}`, fails.length === 0, fails.slice(0, 6).join(' | '));
}

/** Diálogo íntegro en la ventana, cuerpo desplazable, Cerrar visible tras llevarlo al final; el documento no se desplaza. */
async function assertDialog(page, mode, needScroll) {
  await page.waitForTimeout(450); // la hoja entra con una animación de 280 ms
  return page.evaluate(
    ({ mode, needScroll }) => {
      const fails = [];
      const d = document.querySelector('dialog[open]');
      if (!d) return ['sin diálogo'];
      const r = d.getBoundingClientRect();
      const short = innerHeight / parseFloat(getComputedStyle(document.documentElement).fontSize) < 20;
      if (!short && (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5)) fails.push(`diálogo fuera ${Math.round(r.top)}..${Math.round(r.bottom)}`);
      if (mode !== 'flow' && document.documentElement.scrollHeight > innerHeight + 1) fails.push('el documento se desplaza');
      const body = d.querySelector('[data-dialog-body]');
      const scroller = short ? d : body;
      if (needScroll && scroller.scrollHeight <= scroller.clientHeight) fails.push('el cuerpo no se desplaza');
      scroller.scrollTop = scroller.scrollHeight;
      const close = d.querySelector('[data-dialog-head] [data-action="close"]');
      const c = close.getBoundingClientRect();
      if (c.top < -0.5 || c.bottom > innerHeight + 0.5 || c.width < 43.5) fails.push('Cerrar no visible tras desplazar');
      const t = d.querySelector('[data-dialog-head] h2');
      if (t.scrollWidth > t.clientWidth + 1) fails.push('título desborda');
      return fails;
    },
    { mode, needScroll },
  );
}

const SAFE = { side: 47, bottom: 34 };

for (const [id, w, h, scale, mode, extra] of MATRIX) {
  if (only && !only.has(id)) continue;
  const full = FULL_RUN.has(id);
  const factor = extra.font200 ? 2 : 1;
  const { ctx, page } = await newPage({ width: w, height: h }, { deviceScaleFactor: scale, isMobile: !!extra.mobile, hasTouch: !!extra.mobile, label: id });
  await injectFixtures(ctx);
  if (extra.font200) await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'html{font-size:200% !important}';
    document.head.appendChild(s);
  }));
  await page.goto(BASE);
  await page.waitForSelector('main h1', { state: 'attached' });

  // 1. Práctica con "mediana": sin selección → con selección → comprobada; la barra no se mueve
  await openPractice(page, FIX.mediana.id);
  await report(id, 'práctica mediana sin selección', await assertLayout(page, mode, { factor, fixture: FIX.mediana }));
  const barBottom = () => page.evaluate(() => document.querySelector('[data-qregion="actions"]').getBoundingClientRect().bottom + scrollY);
  const b0 = await barBottom();
  await page.locator('label[data-letter="A"]').click();
  const b1 = await barBottom();
  await page.locator('[data-action="check"]').click();
  await page.waitForSelector('[data-feedback]');
  await page.waitForTimeout(300); // la medición del ajuste se recalcula en el cuadro siguiente
  const b2 = await barBottom();
  await report(id, 'práctica mediana comprobada', await assertLayout(page, mode, { factor, fixture: FIX.mediana }));
  // en flow la barra va al final del contenido (no está fija): el criterio de 7 aplica a fit y fit-wide
  if (mode !== 'flow') check(`${id} · comprobar no mueve la barra`, Math.abs(b0 - b1) <= 1 && Math.abs(b1 - b2) <= 1, `${b0} / ${b1} / ${b2}`);
  await shot(page, `${id}-practica-mediana-comprobada`, false);

  // 2. Contenido extenso
  for (const key of ['corta', 'enunciado-largo', 'opciones-largas', 'codigo', 'palabra-larga', 'multiple']) {
    const f = FIX[key];
    await openPractice(page, f.id);
    const fit = await page.getAttribute('[data-qregion="area"]', 'data-fit');
    await report(id, `práctica ${key} (${fit})`, await assertLayout(page, mode, { factor, fixture: f }));
    if (full || ['enunciado-largo', 'opciones-largas', 'codigo'].includes(key)) await shot(page, `${id}-practica-${key}`, false);
    // elegir una opción que requiera desplazarse (la última) y comprobar
    const letters = f.correct;
    for (const L of letters) await page.locator(`label[data-letter="${L}"]`).scrollIntoViewIfNeeded().then(() => page.locator(`label[data-letter="${L}"]`).click());
    await page.locator('[data-action="check"]').click();
    await page.waitForSelector('[data-feedback="correct"]');
    await page.waitForTimeout(300);
    await report(id, `práctica ${key} comprobada`, await assertLayout(page, mode, { factor, fixture: f }));
    if (key === 'opciones-largas') {
      // con el área al final, la última opción queda entera por encima de la franja
      const ok = await page.evaluate(() => {
        const a = document.querySelector('[data-qregion="area"]');
        a.scrollTop = a.scrollHeight;
        const last = [...document.querySelectorAll('[data-letter]')].pop().getBoundingClientRect();
        const s = (document.querySelector('[data-qregion="status"]') ?? document.querySelector('[data-qregion="actions"]')).getBoundingClientRect();
        const noOverflow = [...document.querySelectorAll('[data-letter]')].every((l) => l.scrollHeight <= l.clientHeight + 1 && getComputedStyle(l).overflow === 'visible');
        return { ok: last.bottom <= s.top + 0.5 || document.documentElement.dataset.qlayout === 'flow', noOverflow };
      });
      check(`${id} · opciones largas: la última queda entera sobre la franja y ninguna opción se recorta`, ok.ok && ok.noOverflow, JSON.stringify(ok));
    }
  }

  // 3. Vista completa (si se ofrece)
  if (mode !== 'flow') {
    await openPractice(page, FIX['enunciado-largo'].id);
    // ya se comprobó en el recorrido 2 (la sesión lo recuerda): se reintenta
    if (await page.locator('[data-action="retry"]').count()) await page.locator('[data-action="retry"]').click();
    const fullBtn = page.locator('[data-action="full"]').first();
    const inputs0 = await page.locator('article input').count();
    if (await fullBtn.count()) await fullBtn.click();
    else {
      await page.locator('[data-focus-fallback]').focus();
      await page.keyboard.press('l');
    }
    await page.waitForSelector('[data-view="full"]');
    await page.locator('label[data-letter="C"]').click();
    const inputs1 = await page.locator('article input').count();
    await report(id, 'vista completa', await assertLayout(page, mode, { factor, fixture: FIX['enunciado-largo'] }));
    await shot(page, `${id}-vista-completa`, false);
    await page.locator('[data-action="check"]').click();
    await page.waitForSelector('[data-feedback]');
    await page.locator('[data-qregion="header"] [data-action="full"]').click();
    await page.waitForSelector('[data-view="normal"]');
    const sel = await page.locator('label[data-letter="C"] input').isChecked();
    check(`${id} · vista completa: misma cantidad de opciones, selección conservada, comprobable y salida`, inputs0 === inputs1 && sel, `${inputs0}/${inputs1} ${sel}`);
  }

  // 4. Hojas de explicación (PDF larga e IA larga)
  for (const key of ['explicacion-pdf-larga', 'explicacion-ia-larga']) {
    const f = FIX[key];
    await openPractice(page, f.id);
    await page.locator(`label[data-letter="${f.correct[0]}"]`).click();
    await page.locator('[data-action="check"]').click();
    await page.waitForSelector('[data-action="explanation"]');
    const areaTop0 = await page.evaluate(() => document.querySelector('[data-qregion="area"]').scrollTop);
    await page.locator('[data-action="explanation"]').click();
    await page.waitForSelector('dialog[open][data-sheet="explanation"] section[data-origin]');
    const label = await page.locator('dialog[open] section[data-origin]').getAttribute('aria-label');
    const expected = key.includes('ia') ? 'Explicación generada por IA — no es del PDF' : 'Explicación del PDF (en inglés)';
    // el criterio de la sección 9 (cuerpo desplazable) es para la explicación del PDF de 3000 + 4 × 600 caracteres
    await report(id, `hoja ${key}`, [...(await assertDialog(page, mode, key === 'explicacion-pdf-larga')), ...(label === expected ? [] : [`rótulo ${label}`])]);
    await shot(page, `${id}-hoja-${key}`, false);
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
    const back = await page.evaluate(() => ({ a: document.activeElement?.getAttribute('data-action'), checked: !!document.querySelector('[data-feedback="correct"]'), top: document.querySelector('[data-qregion="area"]').scrollTop }));
    check(`${id} · Esc cierra ${key}: foco al botón, sigue comprobada, mismo scroll`, back.a === 'explanation' && back.checked && Math.abs(back.top - areaTop0) <= 1, JSON.stringify(back));
  }

  if (full) {
    // 5. Motivo, fragmento (texto e imagen), navegador y filtros
    await openPractice(page, FIX['pendiente-larga'].id);
    // en fit-wide la franja está integrada a la barra
    await page.locator('[data-qregion="status"] [data-action="detail"], [data-qregion="actions"] [data-action="detail"]').first().click();
    await page.waitForSelector('dialog[open][data-sheet="detail"]');
    const reasonsOk = await page.evaluate((rs) => rs.every((r) => document.querySelector('dialog[open]').textContent.includes(r)), FIX['pendiente-larga'].review.reasons);
    await report(id, 'hoja "Ver motivo" (motivos literales completos)', [...(await assertDialog(page, mode, false)), ...(reasonsOk ? [] : ['motivos incompletos'])]);
    await shot(page, `${id}-hoja-motivo`, false);
    await page.keyboard.press('Escape');
    for (const [qid, kind] of [['gor-cap1-0001', 'texto'], ['msr-a052', 'imagen']]) {
      await openPractice(page, qid);
      const direct = page.locator('[data-qregion="header"] [data-action="fragment"]');
      if (await direct.count()) await direct.click();
      else {
        await page.locator('[data-action="more"]').click();
        await page.locator('dialog[open]').getByRole('button', { name: /Ver fragmento del PDF/ }).click();
      }
      await page.waitForSelector(kind === 'texto' ? 'dialog[open] pre' : 'dialog[open] img');
      await report(id, `fragmento (${kind})`, await assertDialog(page, mode, false));
      await shot(page, `${id}-fragmento-${kind}`, false);
      await page.keyboard.press('Escape');
      await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
    }
    const nav = page.locator('[data-action="navigator"]');
    if (await nav.count()) {
      await nav.click();
      await page.waitForSelector('dialog[open][data-sheet="navigator"]');
      await page.waitForTimeout(450);
      const navOk = await page.evaluate(() => {
        const d = document.querySelector('dialog[open]');
        const cur = d.querySelector('[aria-current="true"]');
        const r = cur?.getBoundingClientRect();
        const leg = d.querySelector('[aria-label="Leyenda"]')?.getBoundingClientRect();
        // con menos de 20em de alto el diálogo entero se desplaza: la leyenda queda al final, alcanzable con scroll
        const short = innerHeight / parseFloat(getComputedStyle(document.documentElement).fontSize) < 20;
        return { cur: !!cur && r.top >= 0 && r.bottom <= innerHeight, focused: document.activeElement === cur, legend: !!leg && leg.height > 0 && (short || leg.bottom <= innerHeight + 0.5), hscroll: d.scrollWidth > d.clientWidth + 1 };
      });
      await report(id, 'navegador (actual a la vista, leyenda visible, sin desborde)', [...(await assertDialog(page, mode, false)), ...(navOk.cur && navOk.focused && navOk.legend && !navOk.hscroll ? [] : [JSON.stringify(navOk)])]);
      await shot(page, `${id}-navegador`, false);
      await page.locator('dialog[open] [aria-current="true"]').click();
      await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
    }
    const filt = page.locator('[data-qregion="header"] [data-action="filters"]');
    if (await filt.count()) {
      await filt.click();
      await page.waitForSelector('dialog[open][data-sheet="filters"]');
      await report(id, 'hoja de filtros', await assertDialog(page, mode, false));
      await page.keyboard.press('Escape');
    }
  }

  // 6. Examen (Messer extracto, 10 preguntas)
  await go(page, '/examen');
  // clic programático: en ventanas bajas la navegación inferior fija puede tapar las casillas
  const setBox = (loc, on) => loc.evaluate((el, v) => el.checked !== v && el.click(), on);
  await setBox(page.getByRole('checkbox', { name: /Gorgotsias/ }), false);
  await setBox(page.getByRole('checkbox', { name: /Messer \(libro completo\)/ }), false);
  await setBox(page.getByRole('radio', { name: '10' }), true);
  await page.getByRole('button', { name: /Empezar examen/ }).evaluate((el) => el.click());
  await page.waitForSelector('article[data-question-id]');
  await page.waitForTimeout(250);
  await report(id, 'examen en curso', await assertLayout(page, mode, { factor }));
  const finVisible = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-action="finish"]')].some((b) => {
        b.scrollIntoView({ block: 'nearest' });
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1;
      }),
    );
  check(`${id} · examen: "Finalizar" visible en la primera pregunta`, await finVisible());
  await page.locator('label[data-letter="A"]').click();
  const clock = () => page.evaluate(() => {
    const t = document.querySelector('[role="timer"]')?.textContent ?? '';
    const [m, s2] = t.split(':').map(Number);
    return m * 60 + s2;
  });
  const t0 = await clock();
  const timerNode0 = await page.evaluateHandle(() => document.querySelector('[role="timer"]'));
  const exFull = page.locator('[data-action="full"]').first();
  if (mode !== 'flow') {
    if (await exFull.count()) await exFull.click();
    else {
      await page.locator('[data-focus-fallback]').focus();
      await page.keyboard.press('l');
    }
  }
  const navBtn = page.locator('[data-action="navigator"]');
  if (await navBtn.count()) await navBtn.click();
  await page.waitForTimeout(2300);
  const live = await page.evaluate(() => document.querySelector('[role="timer"]')?.textContent);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  if (mode !== 'flow' && (await page.locator('[data-view="full"]').count())) await page.keyboard.press('Escape');
  const t1 = await clock();
  const sameNode = await page.evaluate((n) => n === document.querySelector('[role="timer"]'), timerNode0);
  const selKept = await page.evaluate(() => JSON.parse(localStorage.getItem('secplus:v1:exam-active')).items[0].selected.join(''));
  check(
    `${id} · examen: con navegador y vista completa abiertos el tiempo baja (≥ 2 s), el reloj no se desmonta y la respuesta se conserva`,
    t0 - t1 >= 2 && t0 - t1 <= 5 && sameNode && selKept === 'A' && !!live,
    `${t0}s → ${t1}s (${live}) mismo nodo=${sameNode} sel=${selKept}`,
  );
  await shot(page, `${id}-examen`, false);
  const exText = await page.textContent('main');
  check(`${id} · examen sin cadenas prohibidas`, !/Respuesta del PDF|Explicación|Ver detalle|Ver motivo|Ver análisis|pág\.|Ver fragmento/.test(exText));
  await page.reload();
  await page.waitForSelector('article[data-question-id]');
  check(`${id} · examen: recargar restaura la respuesta`, (await page.locator('label[data-letter="A"] input').isChecked()) === true);
  // ir a la última
  for (let i = 0; i < 9; i++) await page.locator('[data-qregion="actions"] [data-action="next"]').click();
  check(`${id} · examen: "Finalizar" visible en la última pregunta`, await finVisible());
  await page.locator('[data-qregion="actions"] [data-action="finish"]').click();
  await page.getByRole('button', { name: 'Finalizar examen' }).click();
  await page.waitForSelector('text=Resultado del examen');

  if (full) {
    // 7. Revisión
    const hash = await page.evaluate(() => location.hash);
    await page.goto(`${BASE}${hash}/revision/1`);
    await page.waitForSelector('article[data-question-id]');
    await page.waitForTimeout(250);
    await report(id, 'revisión', await assertLayout(page, mode, { factor }));
    await page.locator('[data-action="explanation"]').click();
    await page.waitForSelector('dialog[open][data-sheet="explanation"]');
    await report(id, 'revisión: hoja de explicación', await assertDialog(page, mode, false));
    await shot(page, `${id}-revision-explicacion`, false);
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}${hash}/revision/10`);
    await page.waitForSelector('article[data-question-id]');
    check(`${id} · revisión: la última muestra "Volver al resultado"`, (await page.locator('[data-action="back-to-result"]').textContent()).includes('Volver al resultado'));

    // 8. PBQ
    await go(page, '/pbq/msr-pbq-a1', 'article');
    await page.waitForFunction(() => document.querySelector('main img')?.complete);
    const pbq = await page.evaluate(() => {
      const de = document.documentElement;
      const box = document.querySelector('[data-zoom-viewer]').getBoundingClientRect();
      const tb = document.querySelector('[role="toolbar"]').getBoundingClientRect();
      const bar = document.querySelector('[data-qregion="actions"]').getBoundingClientRect();
      return { mode: de.dataset.qlayout, scroll: de.scrollHeight - innerHeight, box: box.bottom <= innerHeight + 0.5 && box.height > 40, tb: tb.top >= 0 && tb.bottom <= innerHeight, bar: bar.bottom <= innerHeight + 0.5, page: document.querySelector('[role="toolbar"]').textContent.includes('Página 1 de 2') };
    });
    const src1 = await page.locator('main img').getAttribute('src');
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await page.waitForFunction((s) => document.querySelector('main img')?.getAttribute('src') !== s, src1);
    const pbqFails = mode === 'flow' ? (pbq.page ? [] : ['paginador']) : [pbq.scroll > 1 ? 'el documento se desplaza' : '', pbq.box ? '' : 'visor fuera', pbq.tb ? '' : 'barra del visor fuera', pbq.bar ? '' : 'barra fuera', pbq.page ? '' : 'sin "Página 1 de 2"'].filter(Boolean);
    await report(id, 'PBQ A1 (visor, paginador, barras dentro de la ventana)', pbqFails);
    await shot(page, `${id}-pbq-a1`, false);
    await go(page, '/pbq/msf-pbq-b3', 'article');
    await page.waitForFunction(() => document.querySelector('main img')?.complete);
    await shot(page, `${id}-pbq-msf-b3`, false);

    // 9. axe
    await openPractice(page, FIX.mediana.id);
    await axeCheck(page, `${id} práctica`);
    await openPractice(page, 'msf-a014');
    await axeCheck(page, `${id} práctica msf-a014 (7 opciones)`);
    await go(page, '/pbq/msr-pbq-a1', 'article');
    await axeCheck(page, `${id} PBQ`);
  }

  // 10. Solo flow: todo se alcanza con scroll de página; nada fijo ni pegajoso fuera de diálogos
  if (mode === 'flow') {
    await openPractice(page, FIX['opciones-largas'].id);
    const flow = await page.evaluate(() => {
      const fixed = [...document.querySelectorAll('body *')].filter((el) => {
        const cs = getComputedStyle(el);
        if (!['fixed', 'sticky'].includes(cs.position) || el.closest('dialog')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      });
      const bar = document.querySelector('[data-qregion="actions"]');
      bar.scrollIntoView({ block: 'end' });
      const r = bar.getBoundingClientRect();
      return { fixed: fixed.map((e) => e.tagName + '.' + e.className).slice(0, 3), reach: r.bottom <= innerHeight + 0.5 && r.top >= 0, pageScroll: document.documentElement.scrollHeight > innerHeight };
    });
    check(`${id} · flow: sin elementos fijos/pegajosos y la barra se alcanza con scroll de página`, flow.fixed.length === 0 && flow.reach, JSON.stringify(flow));
    await shot(page, `${id}-flow-opciones-largas`, true);
  }

  // Tema oscuro (M4, D1) y márgenes seguros simulados (M4, L2)
  if (id === 'M4' || id === 'D1') {
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await openPractice(page, FIX.mediana.id);
    await report(id, 'tema oscuro', await assertLayout(page, mode, { factor }));
    await axeCheck(page, `${id} práctica oscuro`);
    await shot(page, `${id}-oscuro`, false);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  }
  if (id === 'M4' || id === 'L2') {
    await page.addStyleTag({ content: `:root{--safe-top:${SAFE.bottom}px !important;--safe-bottom:${SAFE.bottom}px !important;--safe-left:${SAFE.side}px !important;--safe-right:${SAFE.side}px !important}` });
    await openPractice(page, FIX.mediana.id);
    await report(id, 'márgenes seguros simulados (34 abajo, 47 a los lados)', await assertLayout(page, mode, { factor, safe: SAFE }));
    await shot(page, `${id}-margenes-seguros`, false);
  }
  // Giro M4 → L2 con una opción elegida y una hoja abierta
  if (id === 'M4') {
    const { ctx: c2, page: p2 } = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, label: 'M4→L2' });
    await injectFixtures(c2);
    await p2.goto(`${BASE}#/practica/${FIX.mediana.id}`);
    await p2.waitForSelector('article[data-question-id]');
    await p2.locator('label[data-letter="B"]').click();
    await p2.locator('[data-action="more"]').click();
    await p2.locator('dialog[open]').getByRole('button', { name: /Ver detalle/ }).click();
    await p2.waitForSelector('dialog[open][data-sheet="detail"]');
    await p2.setViewportSize({ width: 844, height: 390 });
    await p2.waitForTimeout(400);
    const rot = await p2.evaluate(() => {
      const d = document.querySelector('dialog[open]').getBoundingClientRect();
      return { mode: document.documentElement.dataset.qlayout, sel: document.querySelector('label[data-letter="B"] input').checked, inside: d.top >= -0.5 && d.bottom <= innerHeight + 0.5 && d.right <= innerWidth + 0.5 };
    });
    check('M4 → L2: la selección se conserva, el modo pasa a fit-wide y la hoja sigue dentro de la ventana', rot.mode === 'fit-wide' && rot.sel && rot.inside, JSON.stringify(rot));
    await shot(p2, 'M4-giro-L2-hoja', false);
    await c2.close();
  }
  await ctx.close();
}

// ---- Banco real: cuántas preguntas entran completas sin recorte (data-fit="complete") ----
if (process.env.E2E_LAYOUT_BANK === '1') {
  const rows = [];
  for (const [label, w, h] of [
    ['D2 1366×650', 1366, 650],
    ['M4 390×844', 390, 844],
  ]) {
    const { ctx, page } = await newPage({ width: w, height: h }, { label: `bank-${label}` });
    await page.goto(`${BASE}#/practica/gor-cap1-0001`);
    await page.waitForSelector('article[data-question-id]');
    const ids = await page.evaluate(async () => {
      const m = await (await fetch('bank/manifest.json')).json();
      return (await (await fetch(`bank/${m.files.core}`)).json()).map((q) => [q.id, q.doc]);
    });
    const counts = { complete: 0, 'stem-scroll': 0, 'area-scroll': 0 };
    const byDoc = {};
    for (const [qid, doc] of ids) {
      await page.evaluate((q) => (location.hash = `#/practica/${q}`), qid);
      await page.waitForSelector(`article[data-question-id="${qid}"]`);
      const fit = await page.evaluate(
        () =>
          new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => res(document.querySelector('[data-qregion="area"]').dataset.fit))))),
      );
      counts[fit] += 1;
      byDoc[doc] ??= { complete: 0, total: 0 };
      byDoc[doc].total += 1;
      if (fit === 'complete') byDoc[doc].complete += 1;
    }
    const pct = ((counts.complete / ids.length) * 100).toFixed(1);
    rows.push({ label, total: ids.length, ...counts, pct, byDoc });
    check(`Banco real a ${label}: ${counts.complete}/${ids.length} completas sin recorte (${pct} %); visor acotado ${counts['stem-scroll']}, área desplazable ${counts['area-scroll']}`, true);
    await ctx.close();
  }
  writeFileSync(`${OUT}/bank-fit.json`, JSON.stringify(rows, null, 2));
}

const failed = await finish((c) => !c.includes('status of 404'));
process.exit(failed ? 1 : 0);
