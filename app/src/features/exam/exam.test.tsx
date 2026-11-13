import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useExam } from '../../state/examStore';
import { renderApp, resetStores } from '../../test/renderApp';
import { loadedBank } from '../../test/bankFixture';
import type { ExamItem } from '../../grading/types';

const bank = loadedBank();
const item = (id: string, selected: string[] = []): ExamItem => ({ questionId: id, contentHash: bank.indexes.byId.get(id)!.contentHash, selected, flagged: false });

function startExam(items: ExamItem[], timerMinutes: number | null, remainingMs?: number) {
  resetStores(bank);
  const a = useExam.getState().start({ source: 'both', count: items.length, timerMinutes, includeAiProposed: false }, items, bank.manifest.bankVersion);
  if (remainingMs !== undefined) useExam.setState({ active: { ...a, remainingMs } });
  // el arranque de la app relee localStorage: persistir el estado preparado
  useExam.getState().persistActive();
}

describe('Examen', () => {
  it('configuración: máximos 793 / 538 / 45 / 255, combinaciones y exclusión de pendientes', async () => {
    const user = userEvent.setup();
    renderApp('/examen');
    const src = await screen.findByRole('group', { name: 'Origen' });
    expect(within(src).getByText(/Los tres documentos juntos: 793 preguntas distintas disponibles/)).toBeInTheDocument();
    expect(within(src).getByText('538')).toBeInTheDocument();
    expect(within(src).getByText('45')).toBeInTheDocument();
    expect(within(src).getByText('255')).toBeInTheDocument();
    expect(within(src).getByText(/Disponibles con esta selección \(Todos los documentos\): 793 preguntas distintas/)).toBeInTheDocument();
    expect(screen.getByText('Se excluyen las 8 preguntas pendientes de revisión.')).toBeInTheDocument();
    // msr-a080 y msf-a080 son la misma pregunta: 9 de selección múltiple distintas
    expect(screen.getByText('Las 9 preguntas de selección múltiple puntúan todo o nada.')).toBeInTheDocument();
    // Gorgotsias + extracto de Messer (la combinación anterior): 583 y una sola múltiple
    await user.click(within(src).getByRole('checkbox', { name: /Messer \(libro completo\)/ }));
    expect(within(src).getByText(/Disponibles con esta selección \(Gorgotsias \+ Messer \(extracto\)\): 583 preguntas distintas/)).toBeInTheDocument();
    expect(screen.getByText('La pregunta de selección múltiple puntúa todo o nada.')).toBeInTheDocument();
    // los dos libros de Messer juntos: 255 distintas
    await user.click(within(src).getByRole('checkbox', { name: /Gorgotsias/ }));
    await user.click(within(src).getByRole('checkbox', { name: /Messer \(libro completo\)/ }));
    expect(within(src).getByText(/Messer \(extracto\) \+ Messer \(libro completo\)\): 255 preguntas distintas/)).toBeInTheDocument();
    // sin documentos no se puede empezar
    await user.click(within(src).getByRole('checkbox', { name: /Messer \(extracto\)/ }));
    await user.click(within(src).getByRole('checkbox', { name: /Messer \(libro completo\)/ }));
    expect(within(src).getByText('Elegí al menos un documento.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Empezar examen/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('?origen=messerfull preselecciona solo el libro completo', async () => {
    renderApp('/examen?origen=messerfull');
    const src = await screen.findByRole('group', { name: 'Origen' });
    expect(within(src).getByRole('checkbox', { name: /Messer \(libro completo\)/ })).toBeChecked();
    expect(within(src).getByRole('checkbox', { name: /Gorgotsias/ })).not.toBeChecked();
    expect(within(src).getByText(/Disponibles con esta selección \(Messer \(libro completo\)\): 255 preguntas distintas/)).toBeInTheDocument();
  });

  it('durante el examen no aparece insignia, explicación, origen ni indicación de acierto', async () => {
    startExam([item('gor-cap1-0001'), item('msr-a080'), item('gor-cap4-0414')], 45);
    const user = userEvent.setup();
    renderApp('/examen/en-curso', { skipReset: true });
    const art = await screen.findByRole('article');
    await user.click(within(art).getAllByRole('radio')[2]!);
    const text = document.body.textContent ?? '';
    for (const t of ['Respuesta del PDF', 'Explicación', 'Question 1', 'Chapter', 'pág.', 'Ver fragmento', 'Correcto', 'Incorrecto', 'Pendiente de revisión', 'Ver explicación', 'Ver detalle', 'Ver motivo', 'Ver análisis', 'Objetivo'])
      expect(text).not.toContain(t);
    expect(document.querySelector('nav[aria-label="Principal"]')).toBeNull();
    expect(useExam.getState().active!.items[0]!.selected).toEqual(['C']);
  });

  it('finalizar: resultado con totales coherentes; msr-a080 parcial cuenta como incorrecta; queda en el historial', async () => {
    startExam([item('gor-cap1-0001', ['C']), item('msr-a080', ['B']), item('gor-cap1-0002')], null);
    const user = userEvent.setup();
    renderApp('/examen/en-curso', { skipReset: true });
    await screen.findByRole('article');
    await user.click(screen.getAllByRole('button', { name: 'Finalizar' })[0]!);
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(/Respondiste 2 de 3\. Quedan 1 sin responder y 1 incompleta\./)).toBeInTheDocument();
    await user.click(within(dlg).getByRole('button', { name: 'Finalizar examen' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Resultado del examen' })).toBeInTheDocument();
    const a = useExam.getState().attempts.attempts[0]!;
    expect(a.totals).toEqual({ scorable: 3, correct: 1, incorrect: 1, omitted: 1 });
    expect(a.items.find((i) => i.questionId === 'msr-a080')!.result).toBe('incorrect');
    expect(screen.getByText('33,3 %')).toBeInTheDocument();
    expect(screen.getByText(/La nota se calcula sobre las 3 preguntas puntuables/)).toBeInTheDocument();
    expect(useExam.getState().active).toBeNull();
    expect(screen.queryByText(/aprobado/i)).toBeNull();
  });

  it('con el tiempo agotado se cierra solo y el resultado dice "Se terminó el tiempo"', async () => {
    startExam([item('gor-cap1-0001'), item('gor-cap1-0002')], 1, 400);
    renderApp('/examen/en-curso', { skipReset: true });
    await screen.findByRole('article');
    expect(await screen.findByText(/Se terminó el tiempo/, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(useExam.getState().attempts.attempts[0]!.endedBy).toBe('timeout');
  });

  it('revisión: respuesta dada, correcta, explicación con origen y fragmento', async () => {
    startExam([item('gor-cap1-0001', ['B']), item('msr-a080', ['B', 'C'])], null);
    const a = useExam.getState().finish(bank.indexes.byId, 'user')!;
    const user = userEvent.setup();
    renderApp(`/examen/resultado/${a.id}/revision/1`, { skipReset: true });
    const art = await screen.findByRole('article');
    expect(art.querySelector('[data-letter="B"]')).toHaveAttribute('data-state', 'incorrect');
    expect(art.querySelector('[data-letter="C"]')).toHaveAttribute('data-state', 'missed');
    expect(within(art).getByText('Incorrecta')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Explicación del PDF (en inglés)' })).toBeNull();
    await user.click(within(art).getByRole('button', { name: 'Ver explicación del PDF' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('region', { name: 'Explicación del PDF (en inglés)' })).toBeInTheDocument();
    await act(async () => (sheet as HTMLDialogElement).close());
    expect(screen.getByText(/Chapter 1 · General Security Concepts · Question 1/)).toBeInTheDocument();
    await user.click(within(art).getByRole('button', { name: /Ver fragmento del PDF/ }));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/Texto extraído literal del PDF/)).toBeInTheDocument();
    expect(within(dlg).getByRole('tab', { name: /Respuesta/ })).not.toHaveAttribute('aria-disabled');
    await act(async () => {
      (dlg as HTMLDialogElement).close();
    });
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(screen.getByRole('article')).toHaveAttribute('data-question-id', 'msr-a080'));
    expect(screen.getByText('Selección múltiple: todo o nada.')).toBeInTheDocument();
  });

  it('con la vista completa y el navegador abiertos el temporizador sigue bajando y no se desmonta; la respuesta se conserva', async () => {
    startExam([item('msf-a014'), item('gor-cap1-0001'), item('msf-c054')], 45, 60_000);
    const user = userEvent.setup();
    renderApp('/examen/en-curso', { skipReset: true });
    const art = await screen.findByRole('article');
    expect(art).toHaveAttribute('data-question-id', 'msf-a014');
    expect(within(art).getAllByRole('checkbox')).toHaveLength(7);
    await user.click(within(art).getAllByRole('checkbox')[0]!);
    const timer = document.querySelector('[role="timer"]');
    expect(timer).not.toBeNull();
    const before = useExam.getState().active!.remainingMs!;
    await user.keyboard('l');
    expect(document.querySelector('[data-qscreen="exam"]')).toHaveAttribute('data-view', 'full');
    // mismo nodo del reloj: no se desmontó al entrar en la vista completa
    expect(document.querySelector('[role="timer"]')).toBe(timer);
    // msf-a014 tiene opción G: la letra elige la opción (prioridad sobre el atajo del navegador)
    await user.keyboard('g');
    expect(useExam.getState().active!.items[0]!.selected).toEqual(['A', 'G']);
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(document.querySelector('[data-action="navigator"]') as HTMLElement);
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-sheet', 'navigator');
    await new Promise((r) => setTimeout(r, 1300));
    const after = useExam.getState().active!.remainingMs!;
    expect(after).toBeLessThan(before);
    expect(document.querySelector('[role="timer"]')).toBe(timer);
    await act(async () => (screen.getByRole('dialog') as HTMLDialogElement).close());
    expect(useExam.getState().active!.items[0]!.selected).toEqual(['A', 'G']);
    const text = document.body.textContent ?? '';
    for (const t of ['Ver explicación', 'Ver detalle', 'Ver motivo', 'Correcto', 'Respuesta del PDF', 'Objetivo']) expect(text).not.toContain(t);
  });

  it('"Practicar las incorrectas" abre exactamente esos ids', async () => {
    startExam([item('gor-cap1-0001', ['C']), item('gor-cap2-0111', ['A']), item('msr-a050')], null);
    const a = useExam.getState().finish(bank.indexes.byId, 'user')!;
    const wrong = a.items.filter((i) => i.result !== 'correct').map((i) => i.questionId);
    const user = userEvent.setup();
    renderApp(`/examen/resultado/${a.id}`, { skipReset: true });
    await user.click(await screen.findByRole('link', { name: /Practicar las incorrectas/ }));
    const art = await screen.findByRole('article');
    expect(art).toHaveAttribute('data-question-id', wrong[0]);
    expect(within(art).getByText(`1 / ${wrong.length}`)).toBeInTheDocument();
  });
});
