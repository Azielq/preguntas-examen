import { describe, expect, it } from 'vitest';
import { flushAll } from '../storage/storage';
import { KEYS } from '../storage/keys';
import { buildExam, seededRng } from '../grading/buildExam';
import { loadedBank } from '../test/bankFixture';
import { readStoredExam, useExam } from './examStore';
import { readStoredProgress, useProgress } from './progressStore';
import { usePrefs } from './prefsStore';
import { emptyProgress } from '../storage/schema';

const bank = loadedBank();
const Q = (id: string) => bank.indexes.byId.get(id)!;

describe('persistencia', () => {
  it('progreso, favorita y marca sobreviven a "recargar" (releer localStorage)', () => {
    useProgress.setState({ state: emptyProgress(bank.manifest.bankVersion) });
    const st = useProgress.getState();
    st.markSeen(Q('gor-cap1-0001'));
    st.recordAttempt(Q('gor-cap1-0001'), ['C'], 'correct', 'practice');
    st.toggleFavorite(Q('gor-cap1-0001'));
    st.toggleFlag(Q('msr-a080'));
    flushAll();
    const r = readStoredProgress();
    expect(r.value?.questions['gor-cap1-0001']).toMatchObject({ attempts: 1, correctCount: 1, favorite: true, contentHash: Q('gor-cap1-0001').contentHash });
    expect(r.value?.questions['msr-a080']?.flagged).toBe(true);
  });

  it('el examen en curso se guarda con respuestas, marcas, posición y tiempo; al finalizar queda en el historial', () => {
    useProgress.setState({ state: emptyProgress(bank.manifest.bankVersion) });
    const items = buildExam(bank.questions, bank.indexes.units, bank.indexes.byId, { source: 'messer', count: 3, timerMinutes: 3, includeAiProposed: false }, seededRng(4));
    const ex = useExam.getState();
    ex.start({ source: 'messer', count: 3, timerMinutes: 3, includeAiProposed: false }, items, bank.manifest.bankVersion);
    ex.setAnswer(0, Q(items[0]!.questionId).correct);
    ex.toggleFlag(1);
    ex.go(2);
    ex.tick(120_000, 60_000, true);
    const stored = readStoredExam().active!;
    expect(stored.items[0]!.selected).toEqual(Q(items[0]!.questionId).correct);
    expect(stored.items[1]!.flagged).toBe(true);
    expect(stored.currentIndex).toBe(2);
    expect(stored.remainingMs).toBe(120_000);
    expect(stored.bankVersion).toBe(bank.manifest.bankVersion);
    expect(stored.items.every((i) => i.contentHash === Q(i.questionId).contentHash)).toBe(true);

    const attempt = useExam.getState().finish(bank.indexes.byId, 'user')!;
    expect(attempt.totals).toEqual({ scorable: 3, correct: 1, incorrect: 0, omitted: 2 });
    expect(localStorage.getItem(KEYS.examActive)).toBeNull();
    const again = readStoredExam();
    expect(again.attempts.attempts[0]!.id).toBe(attempt.id);
    expect(again.attempts.attempts[0]!.items.every((i) => typeof i.contentHash === 'string' && i.correct.length > 0)).toBe(true);
    flushAll();
    expect(readStoredProgress().value?.questions[items[0]!.questionId]?.last?.mode).toBe('exam');
  });

  it('preferencias (tema) persisten', () => {
    usePrefs.getState().set({ theme: 'dark' });
    expect(JSON.parse(localStorage.getItem(KEYS.prefs)!).theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
