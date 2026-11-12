import type { ExamActive, ProgressState, QuestionProgress } from './schema';

export interface BankRef {
  bankVersion: string;
  hashOf(id: string): string | undefined;
}

export interface ReconcileResult {
  progress: ProgressState;
  examActive: ExamActive | null;
  versionChanged: boolean;
  changed: number; // preguntas con hash distinto (historial reiniciado)
  removed: number; // ids que ya no existen (pasan a orphans)
  examDiscarded: boolean;
}

/** Reconciliación pura del progreso guardado con el banco actual (PLAN 6.4). Los intentos nunca se tocan. */
export function reconcile(progress: ProgressState, examActive: ExamActive | null, bank: BankRef): ReconcileResult {
  let out = progress;
  let changed = 0;
  let removed = 0;
  const versionChanged = progress.bankVersion !== bank.bankVersion;
  if (versionChanged) {
    const questions: Record<string, QuestionProgress> = {};
    const orphans: Record<string, QuestionProgress> = { ...(progress.orphans ?? {}) };
    for (const [id, p] of Object.entries(progress.questions)) {
      const hash = bank.hashOf(id);
      if (hash === undefined) {
        orphans[id] = p;
        removed += 1;
      } else if (hash === p.contentHash) {
        questions[id] = p;
      } else {
        const np: QuestionProgress = {
          contentHash: hash,
          attempts: 0,
          correctCount: 0,
          incorrectCount: 0,
          contentChanged: true,
        };
        if (p.seenAt !== undefined) np.seenAt = p.seenAt;
        if (p.lastSeenAt !== undefined) np.lastSeenAt = p.lastSeenAt;
        if (p.favorite) np.favorite = true;
        if (p.flagged) np.flagged = true;
        questions[id] = np;
        changed += 1;
      }
    }
    out = { ...progress, bankVersion: bank.bankVersion, questions };
    if (Object.keys(orphans).length > 0) out.orphans = orphans;
    if (out.lastPractice && bank.hashOf(out.lastPractice.questionId) === undefined) delete out.lastPractice;
  }
  let exam = examActive;
  let examDiscarded = false;
  if (exam && exam.bankVersion !== bank.bankVersion) {
    const ok = exam.items.every((it) => bank.hashOf(it.questionId) === it.contentHash);
    if (ok) exam = { ...exam, bankVersion: bank.bankVersion };
    else {
      exam = null;
      examDiscarded = true;
    }
  }
  return { progress: out, examActive: exam, versionChanged, changed, removed, examDiscarded };
}

export function reconcileMessage(r: ReconcileResult): string | null {
  if (!r.versionChanged) return null;
  const parts: string[] = [];
  parts.push(
    r.changed === 1 ? '1 pregunta cambió y reinició su historial' : `${r.changed} preguntas cambiaron y reiniciaron su historial`,
  );
  parts.push(r.removed === 1 ? '1 ya no existe' : `${r.removed} ya no existen`);
  return `El banco se actualizó: ${parts.join('; ')}.`;
}
