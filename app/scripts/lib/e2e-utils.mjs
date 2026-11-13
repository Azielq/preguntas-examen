// Auxiliares comunes de los e2e (Playwright + Chromium headless): check, newPage, go, shot, noHScroll, axeCheck.
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
export const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

export async function createRunner({ base, out }) {
  mkdirSync(out, { recursive: true });
  const results = [];
  const consoleProblems = [];
  const browser = await chromium.launch();

  function check(name, ok, detail = '') {
    results.push({ name, ok: !!ok, detail });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
    return !!ok;
  }

  async function newPage(viewport, opts = {}) {
    const ctx = await browser.newContext({ viewport, ...opts });
    const page = await ctx.newPage();
    const tag = opts.label ?? viewport.width;
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') consoleProblems.push(`[${tag}] ${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => consoleProblems.push(`[${tag}] pageerror: ${e.message}`));
    return { ctx, page };
  }

  async function go(page, hash, selector = 'main h1') {
    await page.goto(`${base}#${hash}`);
    await page.waitForSelector(selector, { state: 'attached' });
  }

  async function shot(page, name, full = true) {
    await page.waitForTimeout(350); // dejar terminar transiciones
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  }

  const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  async function axeCheck(page, label) {
    await page.addScriptTag({ content: AXE });
    const r = await page.evaluate(async () => {
      const res = await window.axe.run(document, { resultTypes: ['violations'] });
      return res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    });
    return check(`axe sin infracciones serias/críticas: ${label}`, r.length === 0, r.join(' ; '));
  }

  async function finish(extraFilter = () => true) {
    await browser.close();
    const relevant = consoleProblems.filter(extraFilter);
    check('Sin errores ni advertencias en la consola', relevant.length === 0, relevant.slice(0, 5).join(' | '));
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} verificaciones OK`);
    return failed.length;
  }

  return { browser, results, consoleProblems, check, newPage, go, shot, noHScroll, axeCheck, finish };
}
