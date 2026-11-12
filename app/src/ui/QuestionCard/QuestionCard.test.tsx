import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Question } from '../../bank/types';
import { aiProposedFixture, explanationsMap, loadedBank } from '../../test/bankFixture';
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

/** Muestra fija de 50 ids (incluye msr-a052 y msr-a080, con bloques code). */
function sampleIds(): string[] {
  const ids = bank.questions.filter((_, i) => i % 24 === 0).map((q) => q.id);
  const must = ['msr-a052', 'msr-a080', 'gor-cap1-0001', 'gor-cap1-0023', 'gor-sim6-0514'];
  const out = [...new Set([...must, ...ids])].slice(0, 50);
  return out;
}

describe('fidelidad del texto', () => {
  const ids = sampleIds();
  it('la muestra tiene 50 ids e incluye msr-a052 y msr-a080', () => {
    expect(ids).toHaveLength(50);
    expect(ids).toContain('msr-a052');
    expect(ids).toContain('msr-a080');
  });

  it.each(ids)('%s: enunciado y opciones idénticos carácter por carácter, en orden del banco', (id) => {
    const q = bank.indexes.byId.get(id)!;
    const { container } = renderCard(q);
    const blocks = container.querySelectorAll('article > div[class*="stem"] > *');
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
  });

  it('el <script> literal de msr-a080 se muestra como texto y no crea elementos script', () => {
    const q = bank.indexes.byId.get('msr-a080')!;
    const { container } = renderCard(q);
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(container.querySelector('pre')!.textContent).toContain('<script>alert(2)</script>');
  });
});

describe('insignias de estado', () => {
  it('fixture ai_proposed muestra "Respuesta propuesta por IA — requiere validación"', () => {
    const q = aiProposedFixture();
    renderCard(q, { answerState: 'ai_proposed' });
    expect(screen.getByText('Respuesta propuesta por IA — requiere validación')).toBeInTheDocument();
  });

  it('pendiente: bloque con motivos completos (no tooltip)', () => {
    const q = bank.indexes.byId.get('gor-sim6-0514')!;
    renderCard(q, { answerState: 'pending' });
    for (const r of q.review.reasons) expect(screen.getByText(r)).toBeInTheDocument();
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
    });
    const text = container.textContent ?? '';
    for (const forbidden of ['Respuesta del PDF', 'Explicación', 'Question 1', 'pág.', 'Ver fragmento', 'También aparece', 'Chapter', 'Correct', 'Incorrect', 'favoritas', 'Nota de extracción']) {
      expect(text).not.toContain(forbidden);
    }
    expect(within(container).getByText('Pregunta 3')).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /Borrar respuesta/ })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-state="correct"], [data-state="incorrect"], [data-state="missed"]')).toHaveLength(0);
  });
});
