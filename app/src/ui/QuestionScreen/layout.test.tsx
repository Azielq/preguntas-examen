import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { __openDialogCount, Dialog } from '../Dialog/Dialog';
import { decideFit, MORE_ROW, STEM_MIN_LINES } from './fit';
import { FIT_MIN_HEIGHT_EM, FIT_WIDE_MIN_HEIGHT_EM, FIT_WIDE_MIN_WIDTH_EM, resolveLayoutMode, type LayoutMode } from './layoutMode';

describe('resolveLayoutMode: matriz de ventanas de PLAN-LAYOUT 15.1', () => {
  // [id, ancho px CSS, alto px CSS, fuente raíz px, modo esperado]
  const MATRIX: [string, number, number, number, LayoutMode][] = [
    ['M1', 320, 568, 16, 'fit'],
    ['M2', 360, 560, 16, 'fit'],
    ['M3', 375, 553, 16, 'fit'],
    ['M4', 390, 844, 16, 'fit'],
    ['M5', 430, 932, 16, 'fit'],
    ['L1', 667, 375, 16, 'fit-wide'],
    ['L2', 844, 390, 16, 'fit-wide'],
    ['L3', 932, 430, 16, 'fit-wide'],
    ['T1', 768, 1024, 16, 'fit'],
    ['T2', 1024, 768, 16, 'fit'],
    ['D1', 1280, 720, 16, 'fit'],
    ['D2', 1366, 650, 16, 'fit'],
    ['D3', 1440, 900, 16, 'fit'],
    ['D4', 1920, 1080, 16, 'fit'],
    ['H1', 1280, 400, 16, 'fit-wide'],
    ['H2', 1024, 320, 16, 'fit-wide'],
    ['H3', 360, 420, 16, 'flow'],
    ['Z200', 640, 360, 16, 'fit-wide'],
    ['Z300', 427, 240, 16, 'flow'],
    ['Z400', 320, 256, 16, 'flow'],
    ['F200', 390, 844, 32, 'flow'],
  ];
  it.each(MATRIX)('%s (%i × %i, fuente %i px) → %s', (_id, w, h, fs, mode) => {
    expect(resolveLayoutMode({ widthEm: w / fs, heightEm: h / fs, supportsDvh: true })).toBe(mode);
  });

  it('bordes exactos de los umbrales', () => {
    expect(resolveLayoutMode({ widthEm: 20, heightEm: FIT_MIN_HEIGHT_EM, supportsDvh: true })).toBe('fit');
    expect(resolveLayoutMode({ widthEm: 20, heightEm: 29.99, supportsDvh: true })).toBe('flow');
    expect(resolveLayoutMode({ widthEm: FIT_WIDE_MIN_WIDTH_EM, heightEm: 29.99, supportsDvh: true })).toBe('fit-wide');
    expect(resolveLayoutMode({ widthEm: 39.99, heightEm: 29.99, supportsDvh: true })).toBe('flow');
    expect(resolveLayoutMode({ widthEm: 60, heightEm: FIT_WIDE_MIN_HEIGHT_EM, supportsDvh: true })).toBe('fit-wide');
    expect(resolveLayoutMode({ widthEm: 60, heightEm: 19.99, supportsDvh: true })).toBe('flow');
  });

  it('sin soporte de dvh siempre flow', () => {
    expect(resolveLayoutMode({ widthEm: 90, heightEm: 60, supportsDvh: false })).toBe('flow');
  });
});

describe('decideFit (6.2)', () => {
  const lh = 28;
  it('entra justo → complete', () => {
    expect(decideFit({ hBox: 500, hStem: 300, hRest: 200, lineHeight: lh })).toEqual({ state: 'complete', stemMax: null });
  });
  it('falta 1 px con al menos 5 líneas disponibles → stem-scroll con alto múltiplo de la línea', () => {
    const hRest = 200;
    const hBox = hRest + MORE_ROW + 8 * lh + 5;
    const d = decideFit({ hBox, hStem: hBox - hRest + 1, hRest, lineHeight: lh });
    expect(d.state).toBe('stem-scroll');
    expect(d.stemMax! % lh).toBe(0);
    expect(d.stemMax! / lh).toBeGreaterThanOrEqual(STEM_MIN_LINES);
    expect(d.stemMax).toBe(8 * lh);
  });
  it('solo 4 líneas disponibles → area-scroll', () => {
    const hRest = 300;
    const hBox = hRest + MORE_ROW + 4 * lh + 10;
    expect(decideFit({ hBox, hStem: 600, hRest, lineHeight: lh }).state).toBe('area-scroll');
  });
  it('opciones que no entran solas → area-scroll (las opciones nunca se acotan)', () => {
    expect(decideFit({ hBox: 400, hStem: 100, hRest: 600, lineHeight: lh }).state).toBe('area-scroll');
  });
  it('alturas en 0 (jsdom) → complete', () => {
    expect(decideFit({ hBox: 0, hStem: 0, hRest: 0, lineHeight: 0 }).state).toBe('complete');
  });
});

describe('Dialog endurecido (9.1)', () => {
  function Two() {
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);
    return (
      <>
        <button onClick={() => setA(true)}>abrir A</button>
        <Dialog open={a} onClose={() => setA(false)} title="A">
          <button onClick={() => setB(true)}>abrir B</button>
        </Dialog>
        <Dialog open={b} onClose={() => setB(false)} title="B">
          <p>segundo</p>
        </Dialog>
      </>
    );
  }

  it('contador de bloqueo: cerrar el segundo no desbloquea el fondo mientras el primero siga abierto', async () => {
    const user = userEvent.setup();
    render(<Two />);
    await user.click(screen.getByText('abrir A'));
    expect(document.documentElement.style.overflow).toBe('hidden');
    await user.click(screen.getByText('abrir B'));
    expect(__openDialogCount()).toBe(2);
    const dialogs = document.querySelectorAll('dialog');
    await act(async () => (dialogs[1] as HTMLDialogElement).close());
    expect(document.documentElement.style.overflow).toBe('hidden');
    await act(async () => (dialogs[0] as HTMLDialogElement).close());
    expect(document.documentElement.style.overflow).toBe('');
    expect(__openDialogCount()).toBe(0);
  });

  it('cerrar devuelve el foco al control de origen; si ya no existe, al respaldo [data-focus-fallback]', async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      const [showBtn, setShowBtn] = useState(true);
      return (
        <>
          <h2 tabIndex={-1} data-focus-fallback="">rótulo</h2>
          {showBtn && <button onClick={() => setOpen(true)}>abrir</button>}
          <button onClick={() => setShowBtn(false)}>quitar</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Hoja" size="reading" sheet="detail" focusTitle>
            <button onClick={() => setShowBtn(false)}>quitar origen</button>
          </Dialog>
        </>
      );
    }
    render(<Host />);
    await user.click(screen.getByText('abrir'));
    const dlg = document.querySelector('dialog')!;
    expect(dlg).toHaveAttribute('data-sheet', 'detail');
    // hoja de lectura: el foco va al título
    expect(document.activeElement?.textContent).toBe('Hoja');
    await act(async () => dlg.close());
    expect(document.activeElement?.textContent).toBe('abrir');
    await user.click(screen.getByText('abrir'));
    await user.click(screen.getByText('quitar origen'));
    await act(async () => document.querySelector('dialog')!.close());
    expect(document.activeElement).toHaveAttribute('data-focus-fallback');
  });

  it('Cerrar siempre está en la cabecera y la subcabecera queda fuera del cuerpo desplazable', async () => {
    render(
      <Dialog open onClose={() => {}} title="T" subheader={<p>sub</p>} actions={<button>pie</button>}>
        <p>cuerpo</p>
      </Dialog>,
    );
    const head = document.querySelector('[data-dialog-head]')!;
    expect(head.querySelector('[data-action="close"]')).not.toBeNull();
    const body = document.querySelector('[data-dialog-body]')!;
    expect(body.textContent).toBe('cuerpo');
    expect(body.previousElementSibling?.textContent).toBe('sub');
  });
});
