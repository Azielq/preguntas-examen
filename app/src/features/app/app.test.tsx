import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { useExam } from '../../state/examStore';
import { useProgress } from '../../state/progressStore';
import { useToasts } from '../../state/toastStore';
import { KEYS } from '../../storage/keys';
import { loadedBank, readRaw } from '../../test/bankFixture';
import { renderApp, resetStores } from '../../test/renderApp';

describe('Dashboard', () => {
  it('con almacenamiento vacío no inventa progreso', async () => {
    renderApp('/');
    expect(await screen.findByText('Todavía no empezaste.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay progreso. Los números aparecen cuando respondas tu primera pregunta.')).toBeInTheDocument();
    expect(screen.queryByText('Acertadas')).toBeNull();
    expect(screen.getByText(/534 grupos de preguntas repetidas · 586 preguntas distintas/)).toBeInTheDocument();
  });

  it('la tabla de importación coincide celda por celda con import-report.json', async () => {
    renderApp('/');
    const table = await screen.findByTestId('import-table');
    const { report } = readRaw();
    const g = report.stats.gorgotsias;
    const m = report.stats.messer;
    const expected = [
      ['Encontradas en el PDF', g.found, m.found],
      ['Listas para practicar', g.scorable, m.scorable],
      ['Respuesta del PDF', g.answerFromPdf, m.answerFromPdf],
      ['Propuestas por IA', g.aiProposedAnswers, m.aiProposedAnswers],
      ['Con contradicciones', g.pending, m.pending],
    ].map(([l, a, b]) => [l, String(a), String(b), String((a as number) + (b as number))]);
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => c.textContent));
    expect(rows).toEqual(expected);
  });
});

describe('Ajustes', () => {
  it('lista las 8 pendientes con su motivo y "Abrir" lleva a la pregunta', async () => {
    const user = userEvent.setup();
    renderApp('/ajustes');
    await screen.findByRole('heading', { name: /Preguntas pendientes de revisión \(8\)/ });
    const { report } = readRaw();
    for (const p of report.pending) {
      const li = document.querySelector(`[data-pending-id="${p.id}"]`) as HTMLElement;
      expect(li).not.toBeNull();
      for (const r of p.reasons) expect(within(li).getByText(r)).toBeInTheDocument();
    }
    await user.click(screen.getByRole('link', { name: 'Abrir gor-cap1-0023' }));
    expect(await screen.findByRole('article')).toHaveAttribute('data-question-id', 'gor-cap1-0023');
  });

  it('muestra el par en conflicto gor-cap4-0414 ↔ gor-sim6-0514', async () => {
    renderApp('/ajustes');
    expect((await screen.findAllByRole('link', { name: 'Abrir gor-cap4-0414' })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Abrir gor-sim6-0514' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Pares duplicados con clave distinta (1)' })).toBeInTheDocument();
  });
});

describe('arranque y errores', () => {
  it('localStorage con JSON corrupto no rompe la app y avisa', async () => {
    const bank = loadedBank();
    resetStores(bank);
    localStorage.setItem(KEYS.progress, '{{{');
    localStorage.setItem(KEYS.attempts, '[1,2');
    renderApp('/', { skipReset: true });
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument();
    await waitFor(() => expect(useToasts.getState().toasts.some((t) => t.text.includes('se guardó una copia'))).toBe(true));
    expect(Object.keys(localStorage).some((k) => k.startsWith(`${KEYS.progress}:corrupt:`))).toBe(true);
    expect(useExam.getState().attempts.attempts).toEqual([]);
  });

  it('cambio de bankVersion: reconcilia y avisa con conteos reales', async () => {
    const bank = loadedBank();
    resetStores(bank);
    const q = bank.indexes.byId.get('gor-cap1-0001')!;
    localStorage.setItem(
      KEYS.progress,
      JSON.stringify({
        schemaVersion: 1,
        bankVersion: 'viejo',
        questions: {
          'gor-cap1-0001': { contentHash: 'otro', attempts: 2, correctCount: 2, incorrectCount: 0, favorite: true },
          'gor-cap1-0002': { contentHash: bank.indexes.byId.get('gor-cap1-0002')!.contentHash, attempts: 1, correctCount: 0, incorrectCount: 1 },
          'ya-no-existe': { contentHash: 'x', attempts: 1, correctCount: 1, incorrectCount: 0 },
        },
      }),
    );
    renderApp('/', { skipReset: true });
    await screen.findByRole('heading', { level: 1, name: 'Inicio' });
    await waitFor(() => expect(useToasts.getState().toasts.map((t) => t.text)).toContain('El banco se actualizó: 1 pregunta cambió y reinició su historial; 1 ya no existe.'));
    const st = useProgress.getState().state;
    expect(st.bankVersion).toBe(bank.manifest.bankVersion);
    expect(st.questions['gor-cap1-0001']).toMatchObject({ contentHash: q.contentHash, attempts: 0, favorite: true, contentChanged: true });
    expect(st.questions['gor-cap1-0002']?.attempts).toBe(1);
    expect(st.orphans?.['ya-no-existe']).toBeDefined();
  });

  it('si falla la carga del banco se muestra ErrorState y "Reintentar" funciona', async () => {
    const bank = loadedBank();
    let calls = 0;
    const loader = () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('HTTP 500 al pedir core')) : Promise.resolve(bank);
    };
    const user = userEvent.setup();
    renderApp('/', { loader });
    expect(await screen.findByText('No se pudo cargar el banco de preguntas.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument();
  });
});

describe('accesibilidad (axe-core, sin color-contrast en jsdom)', () => {
  const pages: [string, string][] = [
    ['Dashboard', '/'],
    ['Práctica (selección)', '/practica'],
    ['Práctica (pregunta)', '/practica/msr-a080'],
    ['Examen (configuración)', '/examen'],
    ['Repaso', '/repaso'],
    ['PBQ', '/pbq'],
    ['PBQ detalle', '/pbq/msr-pbq-a1'],
    ['Ajustes', '/ajustes'],
  ];
  it.each(pages)('%s sin infracciones serias ni críticas', async (_name, path) => {
    renderApp(path);
    await screen.findAllByRole('heading', { level: 1 });
    const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(bad).toEqual([]);
  });
});
