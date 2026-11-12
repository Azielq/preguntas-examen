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
  it('configuración: máximos 583 / 538 / 45 y exclusión de pendientes', async () => {
    renderApp('/examen');
    const src = await screen.findByRole('group', { name: 'Origen' });
    expect(within(src).getByText(/583 preguntas distintas disponibles/)).toBeInTheDocument();
    expect(within(src).getByText('538')).toBeInTheDocument();
    expect(within(src).getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Se excluyen las 8 preguntas pendientes de revisión.')).toBeInTheDocument();
    expect(screen.getByText('La pregunta de selección múltiple puntúa todo o nada.')).toBeInTheDocument();
  });

  it('durante el examen no aparece insignia, explicación, origen ni indicación de acierto', async () => {
    startExam([item('gor-cap1-0001'), item('msr-a080'), item('gor-cap4-0414')], 45);
    const user = userEvent.setup();
    renderApp('/examen/en-curso', { skipReset: true });
    const art = await screen.findByRole('article');
    await user.click(within(art).getAllByRole('radio')[2]!);
    const text = document.body.textContent ?? '';
    for (const t of ['Respuesta del PDF', 'Explicación', 'Question 1', 'Chapter', 'pág.', 'Ver fragmento', 'Correcto', 'Incorrecto', 'Pendiente de revisión']) expect(text).not.toContain(t);
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
    expect(within(art).getByRole('region', { name: 'Explicación del PDF (en inglés)' })).toBeInTheDocument();
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
