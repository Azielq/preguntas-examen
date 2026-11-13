import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useProgress } from '../../state/progressStore';
import { progressStats } from '../../state/selectors';
import { renderApp } from '../../test/renderApp';

async function card() {
  return await screen.findByRole('article');
}

describe('Práctica', () => {
  it('gor-cap1-0001: elegir C y comprobar → Correcto, explicación del PDF, pág. 51 y A/B/D por opción', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001');
    const art = await card();
    expect(within(art).getByText('Respuesta del PDF')).toBeInTheDocument();
    const check = screen.getByRole('button', { name: /Comprobar/ });
    expect(check).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(art).getByRole('radio', { name: /Non-repudiation/ }));
    expect(check).not.toHaveAttribute('aria-disabled');
    await user.click(check);
    expect(within(art).getByText('Correcto')).toBeInTheDocument();
    // bajo demanda: ninguna explicación en el DOM hasta abrir la hoja; el botón lleva el origen
    expect(screen.queryByRole('region', { name: 'Explicación del PDF (en inglés)' })).toBeNull();
    expect(art.querySelector('[data-feedback="correct"]')).not.toBeNull();
    const btn = within(art).getByRole('button', { name: 'Ver explicación del PDF' });
    expect(btn).toHaveAttribute('data-origin', 'pdf');
    await user.click(btn);
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveAttribute('data-sheet', 'explanation');
    const expl = within(sheet).getByRole('region', { name: 'Explicación del PDF (en inglés)' });
    expect(within(expl).getByText(/pág\. 51/)).toBeInTheDocument();
    expect(within(expl).getByText('Por qué las otras opciones son incorrectas')).toBeInTheDocument();
    const items = within(expl).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.trim().charAt(0))).toEqual(['A', 'B', 'D']);
    // se registró el intento
    expect(useProgress.getState().state.questions['gor-cap1-0001']).toMatchObject({ attempts: 1, correctCount: 1 });
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('respuesta incorrecta: marca roja en la elegida, discontinua en la correcta y "Tu elección" en la explicación', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001');
    const art = await card();
    await user.click(within(art).getByRole('radio', { name: /Confidentiality/ }));
    await user.click(screen.getByRole('button', { name: /Comprobar/ }));
    expect(within(art).getByText('Elegiste B. La respuesta correcta es C.')).toBeInTheDocument();
    expect(art.querySelector('[data-letter="B"]')).toHaveAttribute('data-state', 'incorrect');
    expect(art.querySelector('[data-letter="C"]')).toHaveAttribute('data-state', 'missed');
    await user.click(within(art).getByRole('button', { name: 'Ver explicación del PDF' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(/Tu elección/)).toBeInTheDocument();
    // cerrar la hoja devuelve el foco al botón y no cambia la selección ni el estado comprobado
    // (jsdom no implementa Esc en <dialog>: se cierra como lo haría el navegador)
    await act(async () => (sheet as HTMLDialogElement).close());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toHaveAttribute('data-action', 'explanation');
    expect(within(art).getByRole('radio', { name: /Confidentiality/ })).toBeChecked();
    expect(art.querySelector('[data-feedback="incorrect"]')).not.toBeNull();
  });

  it('msr-a080: 5 casillas, bloque de código, Comprobar solo con 2, explicación de IA sin sección por opción', async () => {
    const user = userEvent.setup();
    const scriptsBefore = document.querySelectorAll('script').length;
    renderApp('/practica/msr-a080');
    const art = await card();
    const boxes = within(art).getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    const pre = art.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre!.textContent).toContain('value="<script>alert(2)</script>"');
    expect(art.querySelectorAll('[lang="en"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('script').length).toBe(scriptsBefore);
    const check = screen.getByRole('button', { name: /Comprobar/ });
    await user.click(boxes[1]!);
    expect(check).toHaveAttribute('aria-disabled', 'true');
    expect(within(art).getByText('Elegí 2 respuestas (1 de 2)')).toBeInTheDocument();
    await user.click(boxes[2]!);
    expect(check).not.toHaveAttribute('aria-disabled');
    // una tercera no se marca
    await user.click(boxes[3]!);
    expect(boxes[3]).not.toBeChecked();
    expect(within(art).getByText('Ya elegiste 2. Desmarcá una para cambiar.')).toBeInTheDocument();
    await user.click(check);
    expect(within(art).getByText('Correcto')).toBeInTheDocument();
    await user.click(within(art).getByRole('button', { name: 'Ver explicación de IA' }));
    const expl = within(await screen.findByRole('dialog')).getByRole('region', { name: 'Explicación generada por IA — no es del PDF' });
    expect(within(expl).getByText(/clave rápida de respuestas/)).toBeInTheDocument();
    expect(within(expl).getByText(/pág\. PDF 17 \(impresa 33\)/)).toBeInTheDocument();
    expect(within(expl).queryByText('Por qué las otras opciones son incorrectas')).toBeNull();
    expect(expl).toHaveAttribute('data-origin', 'ai');
  });

  it('gor-cap1-0023 (pendiente): muestra el motivo literal, no pinta verde ni rojo y no cambia contadores', async () => {
    const user = userEvent.setup();
    const { bank } = renderApp('/practica/gor-cap1-0023');
    const art = await card();
    const q = bank.indexes.byId.get('gor-cap1-0023')!;
    expect(within(art).getByText('Pendiente de revisión')).toBeInTheDocument();
    expect(within(art).getByText('Esta pregunta no se corrige ni cuenta para la nota.')).toBeInTheDocument();
    // motivo literal completo en la hoja "Ver motivo"
    await user.click(within(art).getByRole('button', { name: 'Ver motivo' }));
    const why = await screen.findByRole('dialog');
    expect(within(why).getByText(q.review.reasons[0]!)).toBeInTheDocument();
    await act(async () => (why as HTMLDialogElement).close());
    const before = progressStats(bank.questions, useProgress.getState().state);
    await user.click(within(art).getAllByRole('radio')[2]!);
    await user.click(screen.getByRole('button', { name: /Ver lo que dice el PDF/ }));
    expect(art.querySelectorAll('[data-state="correct"], [data-state="incorrect"], [data-state="missed"]')).toHaveLength(0);
    expect(art.querySelectorAll('[data-state="neutral-locked"]')).toHaveLength(4);
    expect(within(art).getByText(/El PDF indica la letra C, pero la explicación asociada parece pertenecer a otra pregunta/)).toBeInTheDocument();
    await user.click(within(art).getByRole('button', { name: 'Ver explicación del PDF (no validada)' }));
    expect((await screen.findByRole('dialog')).querySelector('[data-variant="unreliable"]')).not.toBeNull();
    const after = progressStats(bank.questions, useProgress.getState().state);
    expect(after).toEqual(before);
    expect(useProgress.getState().state.questions['gor-cap1-0023']?.last?.outcome).toBe('ungraded');
    expect(useProgress.getState().state.questions['gor-cap1-0023']?.attempts).toBe(0);
  });

  it('atajos de teclado: número elige, Enter comprueba, Enter pasa a la siguiente; se pueden desactivar', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001?sec=cap1&doc=gorgotsias');
    const art = await card();
    await user.keyboard('3');
    expect(within(art).getByRole('radio', { name: /Non-repudiation/ })).toBeChecked();
    await user.keyboard('{Enter}');
    expect(within(art).getByText('Correcto')).toBeInTheDocument();
    await user.keyboard('m');
    expect(useProgress.getState().state.questions['gor-cap1-0001']?.flagged).toBe(true);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('article')).toHaveAttribute('data-question-id', 'gor-cap1-0002'));
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(screen.getByRole('article')).toHaveAttribute('data-question-id', 'gor-cap1-0001'));
  });

  it('con atajos de una tecla desactivados, los números no eligen', async () => {
    const user = userEvent.setup();
    const { usePrefs } = await import('../../state/prefsStore');
    renderApp('/practica/gor-cap1-0001');
    usePrefs.setState({ prefs: { ...usePrefs.getState().prefs, singleKeyShortcuts: false } });
    const art = await card();
    await user.keyboard('3');
    expect(within(art).getByRole('radio', { name: /Non-repudiation/ })).not.toBeChecked();
  });

  it('id inexistente → estado vacío', async () => {
    renderApp('/practica/no-existe');
    expect(await screen.findByText('Esa pregunta no existe en el banco actual')).toBeInTheDocument();
  });

  it('el aviso de duplicado enlaza a la otra copia (en "Ver detalle")', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001');
    const art = await card();
    await user.click(within(art).getByRole('button', { name: /Ver detalle/ }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('link', { name: 'Exam Simulator #1 · Question 92' })).toHaveAttribute('href', '/practica/gor-sim1-0092');
  });

  it('msf-a014 (libro completo): 7 casillas, Comprobar exige 3 marcas, la tecla F elige la opción F (no Favorita) y la explicación es del PDF', async () => {
    const user = userEvent.setup();
    renderApp('/practica/msf-a014?doc=messerfull');
    const art = await card();
    const boxes = within(art).getAllByRole('checkbox');
    expect(boxes).toHaveLength(7);
    const check = screen.getByRole('button', { name: /Comprobar/ });
    await user.keyboard('a');
    await user.keyboard('e');
    expect(check).toHaveAttribute('aria-disabled', 'true');
    expect(within(art).getByText('Elegí 3 respuestas (2 de 3)')).toBeInTheDocument();
    await user.keyboard('f');
    expect(boxes[5]).toBeChecked();
    expect(useProgress.getState().state.questions['msf-a014']?.favorite).toBeFalsy();
    await user.keyboard('f');
    expect(boxes[5]).not.toBeChecked();
    await user.keyboard('g');
    expect(check).not.toHaveAttribute('aria-disabled');
    await user.click(check);
    expect(within(art).getByText('Correcto')).toBeInTheDocument();
    await user.click(within(art).getByRole('button', { name: 'Ver explicación del PDF' }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByRole('region', { name: 'Explicación del PDF (en inglés)' })).toBeInTheDocument();
    expect(within(dlg).getByText(/Messer \(libro completo\) · pág\. PDF 60 \(impresa 51\) · clave rápida: pág\. PDF 42 \(impresa 33\)/)).toBeInTheDocument();
  });

  it('msf-c054 (libro completo): bloque de código enfocable, múltiple de 2 con 5 opciones y objetivo con enlace seguro', async () => {
    renderApp('/practica/msf-c054');
    const art = await card();
    const pre = art.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre).toHaveAttribute('tabindex', '0');
    expect(within(art).getAllByRole('checkbox')).toHaveLength(5);
    const link = art.querySelector('a[target="_blank"]');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('L entra y sale de la vista completa sin perder la selección ni desmontar las opciones', async () => {
    const user = userEvent.setup();
    renderApp('/practica/gor-cap1-0001');
    const art = await card();
    await user.click(within(art).getByRole('radio', { name: /Non-repudiation/ }));
    const inputs = art.querySelectorAll('input').length;
    await user.keyboard('l');
    expect(document.querySelector('[data-qscreen]')).toHaveAttribute('data-view', 'full');
    expect(screen.getByRole('article').querySelectorAll('input').length).toBe(inputs);
    expect(within(screen.getByRole('article')).getByRole('radio', { name: /Non-repudiation/ })).toBeChecked();
    // se puede comprobar desde la vista completa
    await user.click(screen.getByRole('button', { name: /Comprobar/ }));
    expect(within(screen.getByRole('article')).getByText('Correcto')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(document.querySelector('[data-qscreen]')).toHaveAttribute('data-view', 'normal');
    expect(within(screen.getByRole('article')).getByRole('radio', { name: /Non-repudiation/ })).toBeChecked();
  });

  it('barra de acciones: Anterior deshabilitado en la primera, orden de regiones y Terminar en la última', async () => {
    renderApp('/practica/gor-cap1-0001?sec=cap1');
    await card();
    const prev = document.querySelector('[data-action="prev"]')!;
    expect(prev).toHaveAttribute('aria-disabled', 'true');
    expect(document.querySelector('[data-action="check"]')).toHaveAttribute('aria-disabled', 'true');
    const regions = [...document.querySelectorAll('[data-qregion]')].map((e) => e.getAttribute('data-qregion'));
    expect(regions.slice(0, 4)).toEqual(['header', 'area', 'status', 'actions']);
    expect(document.documentElement.getAttribute('data-qlayout')).toBe('fit');
  });
});
