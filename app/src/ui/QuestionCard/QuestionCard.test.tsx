import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Question } from '../../bank/types';
import { aiProposedFixture, explanationsMap, loadedBank } from '../../test/bankFixture';
import type { FitState } from '../QuestionScreen/fit';
import { QuestionCard, type QuestionCardProps } from './QuestionCard';

const bank = loadedBank();

function renderCard(q: Question, extra: Partial<QuestionCardProps> = {}) {
  return render(
    <MemoryRouter>
      <QuestionCard
        question={q}
        mode="practice"
        position={{ index: 1, total: 1 }}
        headerLabel={q.originalLabel}
        selected={[]}
        onSelect={() => {}}
        answerState={q.review.status === 'pending' ? 'pending' : (q.answerStatus as 'pdf')}
        flags={{ favorite: false, flagged: false }}
        onToggleFlag={() => {}}
        onToggleFavorite={() => {}}
        onOpenFragment={() => {}}
        {...extra}
      />
    </MemoryRouter>,
  );
}

/** Muestra fija de 50 ids (incluye msr-a052 y msr-a080, con bloques code, y las del libro completo con viñetas, código y 7 opciones). */
function sampleIds(): string[] {
  const ids = bank.questions.filter((_, i) => i % 24 === 0).map((q) => q.id);
  const must = ['msr-a052', 'msr-a080', 'gor-cap1-0001', 'gor-cap1-0023', 'gor-sim6-0514', 'msf-a014', 'msf-c054', 'msf-c025', 'msf-b039'];
  const out = [...new Set([...must, ...ids])].slice(0, 50);
  return out;
}

function expectLiteral(container: HTMLElement, q: Question) {
  const blocks = container.querySelectorAll('[data-stem] > *');
  expect(blocks).toHaveLength(q.stem.length);
  q.stem.forEach((b, i) => {
    const el = blocks[i]!;
    expect(el.tagName).toBe(b.type === 'code' ? 'PRE' : 'P');
    expect(el.textContent).toBe(b.text);
    expect(el.getAttribute('lang')).toBe('en');
  });
  const rows = container.querySelectorAll('[data-letter]');
  expect([...rows].map((r) => r.getAttribute('data-letter'))).toEqual(q.options.map((o) => o.letter));
  q.options.forEach((o, i) => {
    expect(rows[i]!.querySelector('[lang="en"]')!.textContent).toBe(o.text);
  });
}

describe('fidelidad del texto', () => {
  const ids = sampleIds();
  it('la muestra tiene 50 ids e incluye msr-a052, msr-a080 y msf-a014 (7 opciones, Select THREE)', () => {
    expect(ids).toHaveLength(50);
    expect(ids).toContain('msr-a052');
    expect(ids).toContain('msr-a080');
    expect(ids).toContain('msf-a014');
  });

  it.each(ids)('%s: enunciado y opciones idénticos carácter por carácter, en orden del banco', (id) => {
    const q = bank.indexes.byId.get(id)!;
    const { container } = renderCard(q);
    expectLiteral(container, q);
    // el enunciado está dentro del <article> de la pregunta
    expect(container.querySelector(`article[data-question-id="${id}"] [data-stem]`)).not.toBeNull();
  });

  it.each<FitState>(['complete', 'stem-scroll', 'area-scroll'])('estado %s: el texto sigue completo y literal en toda la muestra', (fit) => {
    for (const id of ids) {
      const q = bank.indexes.byId.get(id)!;
      const { container, unmount } = renderCard(q, { forceFit: fit });
      expect(container.querySelector('[data-qregion="area"]')).toHaveAttribute('data-fit', fit);
      expectLiteral(container, q);
      const vp = container.querySelector('[data-stem-viewport]')!;
      if (fit === 'stem-scroll') {
        expect(vp).toHaveAttribute('tabindex', '0');
        expect(vp).toHaveAttribute('aria-label', 'Enunciado. Continúa: desplazá para leerlo completo.');
        // texto completo en el DOM: nada oculto a lectores de pantalla
        expect(vp.querySelector('[aria-hidden="true"]')).toBeNull();
      }
      unmount();
    }
  });

  it('el <script> literal de msr-a080 se muestra como texto y no crea elementos script', () => {
    const q = bank.indexes.byId.get('msr-a080')!;
    const { container } = renderCard(q);
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(container.querySelector('pre')!.textContent).toContain('<script>alert(2)</script>');
  });

  it('msf-a014: 7 casillas A–G, viñetas como párrafos propios y regla de 3 marcas', async () => {
    const user = userEvent.setup();
    const q = bank.indexes.byId.get('msf-a014')!;
    let selected: string[] = [];
    const { container, rerender } = renderCard(q, { onSelect: (l) => (selected = l) });
    const boxes = within(container).getAllByRole('checkbox');
    expect(boxes).toHaveLength(7);
    expect(container.querySelector('legend')!.textContent).toContain('Elegí 3');
    expect([...container.querySelectorAll('[data-stem] > p')].filter((p) => p.textContent!.startsWith('•'))).toHaveLength(4);
    // con 3 marcadas, una cuarta no se acepta
    rerender(
      <MemoryRouter>
        <QuestionCard
          question={q}
          mode="practice"
          position={{ index: 1, total: 1 }}
          headerLabel={q.originalLabel}
          selected={['A', 'E', 'G']}
          onSelect={(l) => (selected = l)}
          answerState="pdf"
          flags={{ favorite: false, flagged: false }}
          onToggleFlag={() => {}}
        />
      </MemoryRouter>,
    );
    selected = ['A', 'E', 'G'];
    await user.click(within(container).getAllByRole('checkbox')[1]!);
    expect(selected).toEqual(['A', 'E', 'G']);
    expect(screen.getByText('Ya elegiste 3. Desmarcá una para cambiar.')).toBeInTheDocument();
  });
});

describe('insignias de estado', () => {
  it('fixture ai_proposed muestra "Respuesta propuesta por IA — requiere validación"', () => {
    const q = aiProposedFixture();
    renderCard(q, { answerState: 'ai_proposed' });
    expect(screen.getByText('Respuesta propuesta por IA — requiere validación')).toBeInTheDocument();
  });

  it('pendiente: chip, línea fija y "Ver motivo" abre los motivos completos y literales (no tooltip)', async () => {
    const user = userEvent.setup();
    const q = bank.indexes.byId.get('gor-sim6-0514')!;
    renderCard(q, { answerState: 'pending' });
    expect(screen.getByText('Pendiente de revisión')).toBeInTheDocument();
    expect(screen.getByText('Esta pregunta no se corrige ni cuenta para la nota.')).toBeInTheDocument();
    for (const r of q.review.reasons) expect(screen.queryByText(r)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver motivo' }));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('data-sheet', 'detail');
    for (const r of q.review.reasons) expect(within(dlg).getByText(r)).toBeInTheDocument();
  });
});

describe('modo examen', () => {
  it('no muestra insignia, explicación, origen, página, fragmento, favorita ni duplicados', () => {
    const q = bank.indexes.byId.get('gor-cap1-0001')!;
    const { container } = renderCard(q, {
      mode: 'exam',
      headerLabel: 'Pregunta 3',
      selected: ['C'],
      explanation: explanationsMap()['gor-cap1-0001'],
      duplicatesInfo: [{ id: 'gor-sim1-0092', label: 'Exam Simulator #1 · Question 92', to: '/x' }],
      notes: ['nota'],
      onClear: () => {},
    });
    const text = container.textContent ?? '';
    for (const forbidden of [
      'Respuesta del PDF',
      'Explicación',
      'Question 1',
      'pág.',
      'Ver fragmento',
      'También aparece',
      'Chapter',
      'Correct',
      'Incorrect',
      'favoritas',
      'Nota de extracción',
      'Ver explicación',
      'Ver detalle',
      'Ver motivo',
      'Ver análisis',
    ]) {
      expect(text).not.toContain(forbidden);
    }
    expect(within(container).getByText('Pregunta 3')).toBeInTheDocument();
    // "Borrar respuesta" vive en la franja de estado
    const strip = container.querySelector('[data-qregion="status"]') as HTMLElement;
    expect(within(strip).getByRole('button', { name: /Borrar respuesta/ })).toBeInTheDocument();
    expect(within(strip).getByText('Respuesta guardada')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-state="correct"], [data-state="incorrect"], [data-state="missed"]')).toHaveLength(0);
    expect(container.querySelector('[data-action="explanation"], [data-action="detail"], [data-action="fragment"]')).toBeNull();
  });
});

describe('objetivo SY0-701 (libro completo)', () => {
  it('se muestra como metadato con enlace externo seguro (https, noopener noreferrer, nueva pestaña) y nunca en examen', () => {
    const q = bank.indexes.byId.get('msf-a014')!;
    const { container, unmount } = renderCard(q);
    const a = container.querySelector('a[target="_blank"]') as HTMLAnchorElement;
    expect(a).not.toBeNull();
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.href.startsWith('https://')).toBe(true);
    expect(a.textContent).toContain('Objetivo 4.6');
    unmount();
    const ex = renderCard(q, { mode: 'exam', headerLabel: 'Pregunta 1' });
    expect(ex.container.querySelector('a[target="_blank"]')).toBeNull();
    expect(ex.container.textContent).not.toContain('Objetivo');
  });

  it('un objetivo con URL no https no se convierte en enlace', () => {
    const q = { ...bank.indexes.byId.get('msf-a014')!, objective: { code: '4.6', title: 'Access Controls', url: 'javascript:alert(1)' } };
    const { container } = renderCard(q);
    expect(container.querySelector('a[target="_blank"]')).toBeNull();
    expect(container.textContent).toContain('Objetivo 4.6');
  });
});
