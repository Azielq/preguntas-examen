/** Pantalla de pregunta (PLAN-LAYOUT 15.6): atajos nuevos, franja, hojas bajo demanda, análisis en revisión y axe. */
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { __resetAnalysisStore } from '../../state/analysisStore';
import { useContent } from '../../state/contentStore';
import { useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { KEYS } from '../../storage/keys';
import { makeAttempt, storedFor, validOutput } from '../../test/aiFixtures';
import { explanationsMap, loadedBank } from '../../test/bankFixture';
import { renderApp, resetStores } from '../../test/renderApp';

const bank = loadedBank();

async function art() {
  return await screen.findByRole('article');
}

async function noSerious() {
  const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe('franja de estado (7)', () => {
  it('antes de comprobar: ayuda fuera de la región viva, asociada a Comprobar; la región viva existe vacía', async () => {
    renderApp('/practica/gor-cap1-0001');
    const a = await art();
    const strip = a.querySelector('[data-qregion="status"]') as HTMLElement;
    expect(within(strip).getByText('Elegí una opción')).toHaveAttribute('id', 'check-help');
    const live = strip.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe('');
    expect(live.contains(within(strip).getByText('Elegí una opción'))).toBe(false);
    expect(screen.getByRole('button', { name: /Comprobar/ })).toHaveAttribute('aria-describedby', 'check-help');
  });

  it('después de comprobar: veredicto con data-feedback en la región viva y botón de explicación con origen; nada de la explicación en la franja', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001');
    const a = await art();
    await user.click(within(a).getByRole('radio', { name: /Confidentiality/ }));
    await user.click(screen.getByRole('button', { name: /Comprobar/ }));
    const strip = a.querySelector('[data-qregion="status"]') as HTMLElement;
    const v = strip.querySelector('[data-feedback="incorrect"]')!;
    expect(v.closest('[aria-live="polite"]')).not.toBeNull();
    expect(v.textContent).toContain('Elegiste B. La respuesta correcta es C.');
    expect(within(strip).getByRole('button', { name: 'Ver explicación del PDF' })).toBeInTheDocument();
    const expl = explanationsMap()['gor-cap1-0001']!;
    expect(strip.textContent).not.toContain(expl.text.slice(0, 40));
    // el foco no se movió al comprobar: sigue en el mismo botón central, que ahora dice "Reintentar"
    expect(document.activeElement).toHaveAttribute('data-action', 'retry');
    expect(document.activeElement?.closest('[data-qregion="actions"]')).not.toBeNull();
  });

  it('explicación cargando y con error se muestran dentro de la hoja', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001', { preloadContent: false });
    useContent.setState({ explanations: null, explanationsStatus: 'error' });
    const a = await art();
    await user.click(within(a).getByRole('radio', { name: /Non-repudiation/ }));
    await user.click(screen.getByRole('button', { name: /Comprobar/ }));
    useContent.setState({ explanations: null, explanationsStatus: 'error' });
    await user.click(await within(a).findByRole('button', { name: 'Ver explicación del PDF' }));
    const dlg = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dlg).getByText('No se pudo cargar la explicación.')).toBeInTheDocument());
    expect(within(dlg).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('atajos nuevos (13.1)', () => {
  it('X abre la explicación, I el detalle; con una hoja abierta los atajos de pregunta quedan bloqueados', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001');
    const a = await art();
    await user.keyboard('3');
    await user.keyboard('{Enter}');
    await user.keyboard('x');
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveAttribute('data-sheet', 'explanation');
    await user.keyboard('l');
    expect(document.querySelector('[data-qscreen]')).toHaveAttribute('data-view', 'normal');
    await act(async () => (dlg as HTMLDialogElement).close());
    await user.keyboard('i');
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-sheet', 'detail');
    expect(within(a).getByRole('radio', { name: /Non-repudiation/ })).toBeChecked();
  });

  it('en la vista completa funcionan todos los atajos; con atajos de una tecla desactivados, L no hace nada', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001?sec=cap1');
    await art();
    await user.keyboard('l');
    expect(document.querySelector('[data-qscreen]')).toHaveAttribute('data-view', 'full');
    await user.keyboard('2');
    expect(within(screen.getByRole('article')).getByRole('radio', { name: /Confidentiality/ })).toBeChecked();
    // persiste al pasar de pregunta dentro de la misma pantalla
    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('article')).toHaveAttribute('data-question-id', 'gor-cap1-0002'));
    expect(document.querySelector('[data-qscreen]')).toHaveAttribute('data-view', 'full');
    await user.keyboard('l');
    expect(document.querySelector('[data-qscreen]')).toHaveAttribute('data-view', 'normal');
    usePrefs.setState({ prefs: { ...usePrefs.getState().prefs, singleKeyShortcuts: false } });
    await user.keyboard('l');
    expect(document.querySelector('[data-qscreen]')).toHaveAttribute('data-view', 'normal');
  });

  it('AvPág desplaza el área de la pregunta (no depende de la preferencia de una tecla)', async () => {
    usePrefs.setState({ prefs: { ...usePrefs.getState().prefs, singleKeyShortcuts: false } });
    renderApp('/practica/gor-cap1-0001');
    const a = await art();
    const area = a.querySelector('[data-qregion="area"]') as HTMLElement;
    let top = 0;
    Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => 2000 });
    Object.defineProperty(area, 'clientHeight', { configurable: true, get: () => 400 });
    Object.defineProperty(area, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => (top = Math.max(0, v)) });
    const user = userEvent.setup();
    await user.keyboard('{PageDown}');
    expect(top).toBeGreaterThan(0);
    await user.keyboard('{Home}');
    expect(top).toBe(0);
  });
});

describe('Ver análisis de IA en la revisión (9.4)', () => {
  it('aparece solo con un análisis guardado que incluye la pregunta, dentro de AiGenerated, sin llamar a la API', async () => {
    const attempt = makeAttempt(bank);
    resetStores(bank);
    __resetAnalysisStore();
    localStorage.setItem(KEYS.attempts, JSON.stringify({ schemaVersion: 1, attempts: [attempt] }));
    localStorage.setItem(KEYS.analyses, JSON.stringify({ schemaVersion: 1, byAttempt: { [attempt.id]: storedFor(attempt, bank, validOutput()) } }));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();
    // pos 2 = gor-cap1-0002 (está en el concepto c1 de validOutput)
    renderApp(`/examen/resultado/${attempt.id}/revision/2`, { skipReset: true });
    const a = await art();
    await user.click(within(a).getByRole('button', { name: 'Ver análisis de IA' }));
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveAttribute('data-sheet', 'analysis');
    expect(dlg.querySelector('[data-origin="ai"][lang="es"]')).not.toBeNull();
    expect(within(dlg).getByRole('link', { name: 'Abrir tu plan de estudio' })).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('api/analyze'))).toHaveLength(0);
    await act(async () => (dlg as HTMLDialogElement).close());
    // pos 1 (acertada, fuera del análisis): sin botón
    await user.click(screen.getByRole('button', { name: /Anterior/ }));
    await waitFor(() => expect(screen.getByRole('article')).toHaveAttribute('data-question-id', 'gor-cap1-0001'));
    expect(within(screen.getByRole('article')).queryByRole('button', { name: 'Ver análisis de IA' })).toBeNull();
    vi.unstubAllGlobals();
  });

  it('sin análisis guardado no hay botón', async () => {
    const attempt = makeAttempt(bank);
    resetStores(bank);
    __resetAnalysisStore();
    localStorage.setItem(KEYS.attempts, JSON.stringify({ schemaVersion: 1, attempts: [attempt] }));
    renderApp(`/examen/resultado/${attempt.id}/revision/2`, { skipReset: true });
    const a = await art();
    expect(within(a).queryByRole('button', { name: 'Ver análisis de IA' })).toBeNull();
    // la última pregunta muestra "Volver al resultado"
  });

  it('revisión: la última pregunta muestra "Volver al resultado" en la barra', async () => {
    const attempt = makeAttempt(bank);
    resetStores(bank);
    __resetAnalysisStore();
    localStorage.setItem(KEYS.attempts, JSON.stringify({ schemaVersion: 1, attempts: [attempt] }));
    renderApp(`/examen/resultado/${attempt.id}/revision/${attempt.items.length}`, { skipReset: true });
    await art();
    expect(document.querySelector('[data-qregion="actions"] [data-action="back-to-result"]')?.textContent).toContain('Volver al resultado');
  });
});

describe('axe-core en los estados nuevos (sin color-contrast en jsdom)', () => {
  it('práctica sin comprobar', async () => {
    renderApp('/practica/msf-a014');
    await art();
    expect(await noSerious()).toEqual([]);
  });
  it('práctica comprobada con la hoja de explicación abierta', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001');
    const a = await art();
    await user.click(within(a).getByRole('radio', { name: /Non-repudiation/ }));
    await user.click(screen.getByRole('button', { name: /Comprobar/ }));
    await user.click(within(a).getByRole('button', { name: 'Ver explicación del PDF' }));
    await screen.findByRole('dialog');
    expect(await noSerious()).toEqual([]);
  });
  it('vista completa', async () => {
    const user = userEvent.setup();
    renderApp('/practica/msf-c054');
    await art();
    await user.keyboard('l');
    expect(await noSerious()).toEqual([]);
  });
  it('examen en curso', async () => {
    resetStores(bank);
    const items = ['msf-a014', 'gor-cap1-0001'].map((id) => ({ questionId: id, contentHash: bank.indexes.byId.get(id)!.contentHash, selected: [], flagged: false }));
    useExam.getState().start({ source: 'both', count: 2, timerMinutes: 10, includeAiProposed: false }, items, bank.manifest.bankVersion);
    useExam.getState().persistActive();
    renderApp('/examen/en-curso', { skipReset: true });
    await art();
    expect(await noSerious()).toEqual([]);
  });
  it('PBQ del libro completo', async () => {
    renderApp('/pbq/msf-pbq-b3');
    await screen.findByRole('heading', { level: 1, name: /PBQ B3/ });
    expect(await noSerious()).toEqual([]);
  });
});
