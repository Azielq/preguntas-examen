import { screen, waitFor, within } from '@testing-library/react';
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
    const expl = within(art).getByRole('region', { name: 'Explicación del PDF (en inglés)' });
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
    expect(within(art).getByText(/Tu elección/)).toBeInTheDocument();
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
    const expl = within(art).getByRole('region', { name: 'Explicación generada por IA — no es del PDF' });
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
    expect(within(art).getByText(q.review.reasons[0]!)).toBeInTheDocument();
    expect(within(art).getByText('Esta pregunta no se corrige ni cuenta para la nota.')).toBeInTheDocument();
    const before = progressStats(bank.questions, useProgress.getState().state);
    await user.click(within(art).getAllByRole('radio')[2]!);
    await user.click(screen.getByRole('button', { name: /Ver lo que dice el PDF/ }));
    expect(art.querySelectorAll('[data-state="correct"], [data-state="incorrect"], [data-state="missed"]')).toHaveLength(0);
    expect(art.querySelectorAll('[data-state="neutral-locked"]')).toHaveLength(4);
    expect(within(art).getByText(/El PDF indica la letra C, pero la explicación asociada parece pertenecer a otra pregunta/)).toBeInTheDocument();
    expect(art.querySelector('[data-variant="unreliable"]')).not.toBeNull();
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

  it('el aviso de duplicado enlaza a la otra copia', async () => {
    renderApp('/practica/gor-cap1-0001');
    const art = await card();
    expect(within(art).getByRole('link', { name: 'Exam Simulator #1 · Question 92' })).toHaveAttribute('href', '/practica/gor-sim1-0092');
  });
});
