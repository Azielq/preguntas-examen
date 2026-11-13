// Verificación en navegador real (Playwright + Chromium headless) contra `vite preview`.
// Uso: npm run build && npx vite preview --port 4173  (en otra terminal)  →  npm run e2e
// Requiere: npx playwright install chromium. Capturas en e2e-output/.
import { createRunner } from './lib/e2e-utils.mjs';

const BASE = process.env.E2E_URL ?? 'http://localhost:4173/';
const OUT = 'e2e-output';
// En vite preview no hay funciones: /api/ai-status responde 404 a propósito (la app muestra "no disponible").
const notFound = [];
const { results, check, newPage, go, shot, noHScroll, axeCheck, finish } = await createRunner({ base: BASE, out: OUT });

/** Abre una hoja por el botón de la pantalla de pregunta (directo o desde "Más" en pantallas angostas). */
async function openSheet(page, name, tap = false) {
  const direct = page.locator('[data-qregion="header"], [data-qregion="status"]').getByRole('button', { name });
  if ((await direct.count()) > 0 && (await direct.first().isVisible())) await (tap ? direct.first().tap() : direct.first().click());
  else {
    await page.getByRole('button', { name: /^Más$/ }).click();
    await page.locator('dialog[open]').getByRole('button', { name }).click();
  }
  await page.waitForSelector('dialog[open]');
}

// ---------------- Escritorio 1280 ----------------
{
  const { ctx, page } = await newPage({ width: 1280, height: 900 });
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));

  await page.goto(BASE);
  await page.waitForSelector('main h1');
  await page.waitForTimeout(800);
  check('Carga inicial no pide fragmentos ni imágenes de página', !requests.some((u) => u.includes('/fragments/') || u.includes('/pages/')), requests.filter((u) => u.includes('bank')).map((u) => u.split('/bank/')[1]).join(', '));
  check('Dashboard sin progreso inventado', (await page.textContent('main')).includes('Todavía no hay progreso'));
  await shot(page, 'd01-dashboard-light');
  await axeCheck(page, 'Dashboard claro');

  // Skip link y foco
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => document.activeElement?.textContent);
  check('Primer Tab enfoca "Saltar al contenido"', firstFocus === 'Saltar al contenido', firstFocus);
  await page.keyboard.press('Enter');
  check('Saltar al contenido mueve el foco a main', await page.evaluate(() => document.activeElement?.id === 'contenido'));

  // Práctica: única
  await go(page, '/practica/gor-cap1-0001');
  await axeCheck(page, 'Práctica sin comprobar (claro)');
  await page.locator('article label', { hasText: 'Non-repudiation' }).click();
  await page.getByRole('button', { name: /Comprobar/ }).click();
  await page.waitForSelector('[data-feedback="correct"]');
  check('Tras comprobar no hay explicación en el DOM hasta abrir la hoja', (await page.locator('section[data-origin]').count()) === 0);
  await shot(page, 'd02-practica-correcta', false);
  await axeCheck(page, 'Práctica comprobada (claro)');
  await page.getByRole('button', { name: 'Ver explicación del PDF' }).click();
  await page.waitForSelector('dialog[open][data-sheet="explanation"] section[data-origin="pdf"]');
  const expl = await page.locator('dialog[open] section[data-origin="pdf"]').textContent();
  check('gor-cap1-0001 correcta con explicación del PDF, pág. 51 y A/B/D (en la hoja)', expl.includes('Explicación del PDF (en inglés)') && expl.includes('pág. 51') && (await page.locator('dialog[open] section[data-origin="pdf"] li').count()) === 3);
  await shot(page, 'd02b-practica-hoja-explicacion', false);
  await axeCheck(page, 'Práctica con hoja de explicación (claro)');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
  check('Esc cierra la hoja de explicación y el foco vuelve a su botón', (await page.evaluate(() => document.activeElement?.getAttribute('data-action'))) === 'explanation');

  // Fragmento Gorgotsias (texto)
  const fragBefore = requests.filter((u) => u.includes('/fragments/')).length;
  await page.getByRole('button', { name: /Ver fragmento del PDF/ }).click();
  await page.waitForSelector('dialog[open] pre');
  const pre = await page.locator('dialog[open] pre').textContent();
  check('Modal Gorgotsias muestra texto literal con saltos de renglón', pre.includes('Question 1. A client disputes having signed a digital contract.\nThe service provider'));
  check('Fragmento cap1 se pide al abrir el modal', requests.filter((u) => u.includes('/fragments/cap1.')).length === 1 && fragBefore === 0);
  await page.getByRole('tab', { name: /Respuesta/ }).click();
  check('Pestaña Respuesta disponible tras comprobar', (await page.locator('dialog[open] pre').textContent()).includes('Correct Answer: C'));
  await shot(page, 'd03-fragmento-gorgotsias', false);
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
  const back = await page.evaluate(() => document.activeElement?.textContent ?? '');
  check('Esc cierra y el foco vuelve al botón de origen', back.includes('Ver fragmento del PDF') && (await page.locator('dialog[open]').count()) === 0, back);

  // Persistencia tras recargar + favorita
  await page.getByRole('button', { name: 'Agregar a favoritas' }).click();
  await page.reload();
  await page.waitForSelector('article');
  check('Tras recargar: favorita y "Última vez" (en la franja) persisten', (await page.getByRole('button', { name: 'Quitar de favoritas' }).count()) === 1 && (await page.textContent('[data-qregion="status"]')).includes('Última vez: correcta'));

  // Respuesta bloqueada antes de comprobar
  await go(page, '/practica/gor-cap1-0002');
  await page.getByRole('button', { name: /Ver fragmento del PDF/ }).click();
  await page.waitForSelector('dialog[open] pre');
  check('Pestaña Respuesta bloqueada antes de comprobar', (await page.getByRole('tab', { name: /Respuesta/ }).getAttribute('aria-disabled')) === 'true');
  const cap1Count = requests.filter((u) => u.includes('/fragments/cap1.')).length;
  await page.keyboard.press('Escape');
  await page.locator('[data-qregion="actions"]').getByRole('button', { name: /Siguiente/ }).click();
  await page.waitForSelector('article[data-question-id="gor-cap1-0003"]');
  await page.getByRole('button', { name: /Ver fragmento del PDF/ }).click();
  await page.waitForSelector('dialog[open] pre');
  check('Fragmento de cap1 se pide una sola vez por sección', requests.filter((u) => u.includes('/fragments/cap1.')).length === cap1Count, `${cap1Count} pedido(s) en esta carga de página`);
  await page.keyboard.press('Escape');

  // Múltiple msr-a080 + imagen Messer
  await go(page, '/practica/msr-a080');
  check('msr-a080: <script> literal no crea elementos script', (await page.locator('main script').count()) === 0 && (await page.locator('pre').first().textContent()).includes('<script>alert(2)</script>'));
  // al pasar de pregunta el foco no se mueve (seguía en "Ver fragmento"): se parte del rótulo de la pregunta
  await page.locator('[data-focus-fallback]').focus();
  await page.keyboard.press('2');
  const disabledWithOne = await page.getByRole('button', { name: /Comprobar/ }).getAttribute('aria-disabled');
  await page.keyboard.press('3');
  check('msr-a080: Comprobar solo con 2 marcadas (atajos numéricos)', disabledWithOne === 'true' && (await page.getByRole('button', { name: /Comprobar/ }).getAttribute('aria-disabled')) === null);
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-feedback]');
  check('msr-a080: el botón de explicación lleva el origen IA', (await page.locator('[data-action="explanation"]').getAttribute('data-origin')) === 'ai');
  await page.keyboard.press('x');
  await page.waitForSelector('dialog[open] section[data-origin="ai"]');
  const aiExpl = await page.locator('dialog[open] section[data-origin="ai"]').textContent();
  check('msr-a080: correcta, explicación de IA rotulada, clave rápida pág. PDF 17 (impresa 33)', aiExpl.includes('Explicación generada por IA — no es del PDF') && aiExpl.includes('pág. PDF 17 (impresa 33)') && !aiExpl.includes('Por qué las otras'));
  await shot(page, 'd04-msr-a080-comprobada', false);
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
  await page.keyboard.press('v');
  await page.waitForSelector('dialog[open] img');
  await page.waitForFunction(() => {
    const i = document.querySelector('dialog[open] img');
    return i && i.complete && i.naturalWidth > 0;
  });
  const img = await page.evaluate(() => {
    const i = document.querySelector('dialog[open] img');
    return { src: i.getAttribute('src'), w: i.naturalWidth, h: i.naturalHeight };
  });
  check('Modal Messer muestra la imagen de la página 11', img.src.endsWith('pages/messer/p-11.jpg') && img.w > 0, `${img.src} ${img.w}x${img.h}`);
  await shot(page, 'd05-fragmento-messer-fit', false);
  const lvl0 = await page.locator('dialog[open] [role="toolbar"] span[aria-hidden]').textContent();
  await page.getByRole('button', { name: 'Acercar' }).click();
  await page.locator('dialog[open] [data-zoom-viewer]').focus();
  await page.keyboard.press('+');
  const lvl2 = await page.locator('dialog[open] [role="toolbar"] span[aria-hidden]').textContent();
  const scrollable = await page.evaluate(() => {
    const b = document.querySelector('dialog[open] [data-zoom-viewer]');
    b.scrollLeft = 200;
    b.scrollTop = 300;
    return b.scrollWidth > b.clientWidth && b.scrollLeft > 0 && b.scrollTop > 0;
  });
  check('Zoom con botón y tecla + cambia el nivel; la imagen ampliada se desplaza', lvl0 !== lvl2 && scrollable, `${lvl0} → ${lvl2}`);
  await page.keyboard.down('Control');
  await page.mouse.move(640, 500);
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');
  const lvl3 = await page.locator('dialog[open] [role="toolbar"] span[aria-hidden]').textContent();
  check('Ctrl + rueda hace zoom', lvl3 !== lvl2, `${lvl2} → ${lvl3}`);
  await shot(page, 'd06-fragmento-messer-zoom', false);
  await page.keyboard.press('Escape');

  // Pendiente
  await go(page, '/practica/gor-cap1-0023');
  const art = await page.textContent('article');
  await openSheet(page, 'Ver motivo');
  const why = await page.textContent('dialog[open]');
  check('gor-cap1-0023 muestra "Pendiente de revisión" y el motivo (hoja "Ver motivo")', art.includes('Pendiente de revisión') && art.includes('no se corrige') && why.includes('Contradicción en el PDF'));
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => {});
  await page.getByRole('button', { name: /Ver lo que dice el PDF/ }).click();
  await page.waitForSelector('[data-feedback="unreliable"]');
  check('Pendiente revelada: sin verde ni rojo', (await page.locator('[data-state="correct"],[data-state="incorrect"],[data-state="missed"]').count()) === 0);
  await shot(page, 'd07-pendiente-revelada');

  // Examen completo
  await go(page, '/examen');
  await axeCheck(page, 'Examen configuración');
  // solo el extracto de Messer (como antes): se destildan los otros dos documentos
  await page.getByRole('checkbox', { name: /Gorgotsias/ }).uncheck({ force: true });
  await page.getByRole('checkbox', { name: /Messer \(libro completo\)/ }).uncheck({ force: true });
  check('Examen: máximo del extracto de Messer = 45', (await page.textContent('main')).includes('(Messer (extracto)): 45 preguntas distintas'));
  await page.getByRole('radio', { name: '10' }).check({ force: true });
  await shot(page, 'd08-examen-config');
  await page.getByRole('button', { name: /Empezar examen/ }).click();
  await page.waitForSelector('article');
  check('Examen en curso: modo foco sin navegación principal', (await page.locator('nav[aria-label="Principal"]').count()) === 0);
  const examText = await page.textContent('main');
  check('Examen en curso: sin insignias, explicación ni página', !/Respuesta del PDF|Explicación|pág\.|Ver fragmento/.test(examText));
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('m');
  await page.waitForTimeout(300);
  await shot(page, 'd09-examen-en-curso');
  await axeCheck(page, 'Examen en curso');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('secplus:v1:exam-active')));
  await page.reload();
  await page.waitForSelector('article');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('secplus:v1:exam-active')));
  check(
    'Recargar a mitad del examen restaura respuestas, marcas, posición y tiempo',
    after && after.id === before.id && after.currentIndex === 4 && JSON.stringify(after.items.map((i) => i.selected)) === JSON.stringify(before.items.map((i) => i.selected)) && after.items[4].flagged && after.remainingMs <= before.remainingMs && after.remainingMs > 0,
    `pos ${after?.currentIndex}, quedan ${Math.round((after?.remainingMs ?? 0) / 1000)} s`,
  );
  check('Tras recargar se muestra "Pregunta 5 de 10"', (await page.textContent('main h1')).includes('Pregunta 5 de 10'));
  await page.getByRole('button', { name: 'Finalizar' }).first().click();
  await page.waitForSelector('dialog[open]');
  await shot(page, 'd10-examen-confirmar', false);
  await page.getByRole('button', { name: 'Finalizar examen' }).click();
  await page.waitForSelector('text=Resultado del examen');
  const res = await page.textContent('main');
  const m = res.match(/(\d+) correctas\s*(\d+) incorrectas\s*(\d+) omitidas/);
  check('Resultado: correctas + incorrectas + omitidas = 10', m && Number(m[1]) + Number(m[2]) + Number(m[3]) === 10, m?.slice(1).join('/'));
  await shot(page, 'd11-resultado');
  await axeCheck(page, 'Resultado');
  await page.getByRole('link', { name: 'Revisar todas' }).click();
  await page.waitForSelector('article');
  await shot(page, 'd12-revision', false);
  await page.keyboard.press('x');
  await page.waitForSelector('dialog[open] section[data-origin="ai"]');
  check('Revisión muestra explicación rotulada (hoja)', (await page.textContent('dialog[open]')).includes('Explicación generada por IA'));
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForSelector('article');
  check('El intento sobrevive a recargar', (await page.evaluate(() => JSON.parse(localStorage.getItem('secplus:v1:attempts')).attempts.length)) === 1);

  // Repaso
  await go(page, '/repaso?tab=historial');
  await shot(page, 'd13-repaso-historial');
  await go(page, '/repaso?tab=falladas');
  await shot(page, 'd14-repaso-falladas');
  await axeCheck(page, 'Repaso');

  // PBQ
  await go(page, '/pbq');
  await page.waitForSelector('main li');
  check('PBQ lista 20 soluciones (5 del extracto + 15 del libro completo)', (await page.locator('main li.card, main li[class*="card"]').count()) === 20);
  await go(page, '/pbq/msr-pbq-a1');
  await page.waitForFunction(() => [...document.querySelectorAll('main img')].every((i) => i.complete && i.naturalWidth > 0) && document.querySelectorAll('main img').length === 1);
  const pageText1 = await page.textContent('[data-zoom-viewer]').then(() => page.locator('[role="toolbar"]').textContent());
  const src1 = await page.locator('main img').getAttribute('src');
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await page.waitForFunction((s1) => document.querySelector('main img')?.getAttribute('src') !== s1, src1);
  check(
    'PBQ A1: una página por vez con paginador ("Página 1 de 2") y sin controles de respuesta',
    pageText1.includes('Página 1 de 2') && (await page.locator('[role="toolbar"]').textContent()).includes('Página 2 de 2') && (await page.locator('main input[type=radio], main input[type=checkbox]').count()) === 0,
  );
  await shot(page, 'd15-pbq-a1', false);
  await axeCheck(page, 'PBQ detalle');
  await go(page, '/pbq/msf-pbq-b3');
  await page.waitForFunction(() => document.querySelector('main img')?.complete);
  const b3 = await page.textContent('main');
  check('PBQ B3 del libro completo: enunciado y solución, avisa que la página comparte otra PBQ', b3.includes('Enunciado') && /también contiene la PBQ B4/.test(b3) && (await page.locator('[role="toolbar"]').textContent()).includes('Página 1 de'));
  await shot(page, 'd15b-pbq-msf-b3', false);

  // Ajustes
  await go(page, '/ajustes');
  await shot(page, 'd16-ajustes');
  await axeCheck(page, 'Ajustes');

  // Tema oscuro
  await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click();
  await page.reload();
  await page.waitForSelector('main h1');
  check('Tema oscuro persiste tras recargar', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await go(page, '/');
  await shot(page, 'd17-dashboard-dark');
  await axeCheck(page, 'Dashboard oscuro');
  await go(page, '/practica/gor-cap1-0001');
  await page.locator('article label', { hasText: 'Confidentiality' }).click();
  await page.getByRole('button', { name: /Comprobar/ }).click();
  await page.waitForSelector('[data-feedback]');
  await shot(page, 'd18-practica-incorrecta-dark');
  await axeCheck(page, 'Práctica comprobada (oscuro)');
  await go(page, '/practica/gor-cap1-0023');
  await axeCheck(page, 'Pendiente (oscuro)');
  await go(page, '/pbq/msr-pbq-a1');
  await axeCheck(page, 'PBQ (oscuro)');
  await go(page, '/ajustes');
  await axeCheck(page, 'Ajustes (oscuro)');

  // Foco visible por teclado sobre una opción
  await go(page, '/practica/gor-cap1-0005');
  await page.locator('article input[type=radio]').first().focus();
  await page.keyboard.press('ArrowDown');
  await shot(page, 'd19-foco-opcion-dark', false);
  const ring = await page.evaluate(() => {
    const lab = document.activeElement?.closest('label');
    return lab ? getComputedStyle(lab).outlineStyle + ' ' + getComputedStyle(lab).outlineWidth : 'none';
  });
  check('Foco visible sobre la fila de opción', ring.startsWith('solid 3px'), ring);

  for (const w of [320, 768, 1100, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const h of ['/', '/practica/msr-a080', '/examen', '/ajustes']) {
      await go(page, h);
      if (!(await noHScroll(page))) check(`Sin scroll horizontal a ${w}px en ${h}`, false);
    }
    await go(page, '/');
    await shot(page, `d20-shell-${w}`, false);
  }
  check('Sin scroll horizontal a 320/768/1100/1440 en Inicio, Práctica, Examen y Ajustes', !results.some((r) => r.name.startsWith('Sin scroll horizontal a') && !r.ok));
  await ctx.close();
}

// ---------------- Móvil 390 ----------------
{
  const { ctx, page } = await newPage({ width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(BASE);
  await page.waitForSelector('main h1');
  await shot(page, 'm01-dashboard');
  check('Móvil: navegación inferior visible', await page.locator('nav[aria-label="Principal"]').last().isVisible());
  check('Móvil: sin scroll horizontal (Inicio)', await noHScroll(page));
  await go(page, '/practica');
  await shot(page, 'm02-practica-seleccion');
  await go(page, '/practica/msr-a080');
  await page.locator('article label[data-letter="B"]').tap();
  await page.locator('article label[data-letter="C"]').tap();
  await page.getByRole('button', { name: /Comprobar/ }).tap();
  await page.waitForSelector('[data-feedback]');
  await shot(page, 'm03-msr-a080', false);
  check('Móvil: sin scroll horizontal (msr-a080 con log)', await noHScroll(page));
  const bar = await page.evaluate(() => {
    const b = document.querySelector('[data-qregion="actions"]');
    const r = b.getBoundingClientRect();
    return { pos: getComputedStyle(b).position, bottom: Math.round(window.innerHeight - r.bottom), bottomNav: [...document.querySelectorAll('nav[aria-label="Principal"]')].filter((n) => n.getClientRects().length > 0).length, docScroll: document.documentElement.scrollHeight - window.innerHeight };
  });
  check('Móvil: barra de acciones como fila de la grilla, al pie de la ventana, sin navegación inferior ni scroll de página', bar.pos !== 'fixed' && bar.bottom >= 0 && bar.bottom <= 2 && bar.bottomNav === 0 && bar.docScroll <= 1, JSON.stringify(bar));
  await openSheet(page, /Ver fragmento del PDF/);
  await page.waitForFunction(() => {
    const i = document.querySelector('dialog[open] img');
    return i && i.complete && i.naturalWidth > 0;
  });
  await shot(page, 'm04-fragmento-messer', false);
  await page.keyboard.press('Escape');
  await go(page, '/practica/gor-cap1-0001');
  await openSheet(page, /Ver fragmento del PDF/);
  await page.waitForSelector('dialog[open] pre');
  await shot(page, 'm05-fragmento-gorgotsias', false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Filtros/ }).tap();
  await page.waitForSelector('dialog[open]');
  await shot(page, 'm06-filtros', false);
  await page.keyboard.press('Escape');
  await go(page, '/examen');
  await page.getByRole('radio', { name: '10' }).check({ force: true });
  await page.getByRole('button', { name: /Empezar examen/ }).tap();
  await page.waitForSelector('article');
  await shot(page, 'm07-examen', false);
  check('Móvil examen: sin navegación inferior', (await page.locator('nav[aria-label="Principal"]').count()) === 0);
  await page.getByRole('button', { name: 'Finalizar' }).first().tap();
  await page.getByRole('button', { name: 'Finalizar examen' }).tap();
  await page.waitForSelector('text=Resultado del examen');
  await shot(page, 'm08-resultado');
  check('Móvil: sin scroll horizontal (resultado)', await noHScroll(page));
  await go(page, '/pbq/msr-pbq-a5');
  await shot(page, 'm09-pbq-a5');
  await go(page, '/ajustes');
  await shot(page, 'm10-ajustes');
  check('Móvil: sin scroll horizontal (ajustes)', await noHScroll(page));
  await axeCheck(page, 'Ajustes móvil');
  await ctx.close();
}

// ---------------- Error al cargar el banco + reintento ----------------
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  let fail = true;
  await page.route('**/bank/core.*.json', (route) => (fail ? route.fulfill({ status: 500, body: 'x' }) : route.continue()));
  await page.goto(BASE);
  await page.waitForSelector('text=No se pudo cargar el banco de preguntas.');
  await shot(page, 'e01-error-banco', false);
  fail = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await page.waitForSelector('main h1');
  check('Fallo al pedir core → ErrorState y Reintentar funciona', (await page.textContent('main h1')) === 'Inicio');
  // reduced motion
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const dur = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dur-2').trim());
  check('prefers-reduced-motion reduce las duraciones', parseFloat(dur) < 1 && dur.endsWith('ms'), dur);
  await ctx.close();
}

const only404Api = notFound.every((u) => u.includes('/api/ai-status'));
check('Los únicos 404 son de /api/ai-status (sin funciones en vite preview)', only404Api, [...new Set(notFound)].join(', '));
const failed = await finish((c) => !c.includes('Failed to load resource: the server responded with a status of 500') && !(only404Api && c.includes('status of 404')));
process.exit(failed ? 1 : 0);
