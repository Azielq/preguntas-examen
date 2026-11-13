import { ArrowLeft, ListChecks, Play, RefreshCw, RotateCcw, Settings as SettingsIcon, Sparkles, TriangleAlert, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import type { LoadedBank } from '../../bank/types';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { es, formatDate, formatDuration } from '../../i18n/es';
import { useAnalysis, type RequestState } from '../../state/analysisStore';
import { useExam } from '../../state/examStore';
import { useProgress } from '../../state/progressStore';
import type { ExamAttempt, StoredAnalysis } from '../../storage/schema';
import { AiGenerated, AiText } from '../../ui/AiGenerated/AiGenerated';
import { Button, ButtonLink } from '../../ui/Button/Button';
import { ConceptCard } from '../../ui/ConceptCard/ConceptCard';
import { Dialog } from '../../ui/Dialog/Dialog';
import { EvidenceQuestion } from '../../ui/EvidenceQuestion/EvidenceQuestion';
import { StudyPlanSkeleton } from '../../ui/StudyPlanSkeleton/StudyPlanSkeleton';
import { NotFound } from '../app/NotFound';
import { practiceUrl } from '../practice/filterQuery';
import { attemptCounts, buildAnalyzeRequest } from './analysisData';
import { planPracticeUrl } from './analysisPaths';
import { configSourceLabel } from './ExamSetup';
import { NoErrorsPanel } from './NoErrorsPanel';
import { buildPlanView, type EvidenceView, type PlanView } from './studyPlanModel';
import s from './StudyPlan.module.css';
import { useAiAccess, type AiAccess } from './useAiAvailability';

const LEVEL_TITLE = es.ai.priority;

function firstInBankOrder(ids: string[], bank: LoadedBank): string | undefined {
  return ids.filter((id) => bank.indexes.byId.has(id)).sort((a, b) => bank.indexes.order.get(a)! - bank.indexes.order.get(b)!)[0];
}

function Evidence({ e, open, withNote = true }: { e: EvidenceView; open?: boolean; withNote?: boolean }) {
  if (!e.question) return <p className="small muted">{`(pregunta ${e.id} ya no existe en el banco)`}</p>;
  return (
    <EvidenceQuestion
      question={e.question}
      selected={e.item.selected}
      correct={e.item.correct}
      result={e.item.result}
      pageLabel={e.pageLabel}
      explanationRef={e.explanationRef}
      reviewHref={e.reviewHref}
      note={withNote ? e.note : undefined}
      defaultOpen={open}
      changed={e.changed}
    />
  );
}

export function StudyPlan() {
  const { attemptId = '' } = useParams();
  const bank = useBank();
  const attempt = useExam((st) => st.attempts.attempts.find((a) => a.id === attemptId));
  useDocumentTitle('Tu plan de estudio');
  if (!attempt) return <NotFound title="No encontramos ese resultado" description="El intento no está en el historial de este navegador." />;
  return <StudyPlanFor attempt={attempt} bank={bank} />;
}

function StudyPlanFor({ attempt, bank }: { attempt: ExamAttempt; bank: LoadedBank }) {
  const access = useAiAccess();
  const analysis = useAnalysis((st) => st.analyses.byAttempt[attempt.id]);
  const incompatible = useAnalysis((st) => st.incompatible.includes(attempt.id));
  const request = useAnalysis((st) => st.requests[attempt.id]);
  const lastEvent = useAnalysis((st) => st.lastEvent);
  const start = useAnalysis((st) => st.start);
  const cancel = useAnalysis((st) => st.cancel);
  const progress = useProgress((st) => st.state);
  const kind = buildAnalyzeRequest(attempt, bank, progress).kind;
  const resultHref = `/examen/resultado/${attempt.id}`;

  const summaryRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLHeadingElement>(null);
  const analyzeRef = useRef<HTMLButtonElement>(null);
  const mountedSeq = useRef(lastEvent?.seq ?? 0);
  const [announce, setAnnounce] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);

  const promptVersion = access.kind === 'ready' ? access.promptVersion : null;
  const view = useMemo(() => (analysis ? buildPlanView(analysis, attempt, bank, promptVersion) : null), [analysis, attempt, bank, promptVersion]);

  // Región viva y foco al terminar (éxito → Resumen; error → encabezado del error; cancelar → botón Analizar)
  useEffect(() => {
    if (request?.status === 'loading') setAnnounce(es.ai.analyzing);
  }, [request?.status]);
  useEffect(() => {
    if (!lastEvent || lastEvent.attemptId !== attempt.id || lastEvent.seq <= mountedSeq.current) return;
    mountedSeq.current = lastEvent.seq;
    const id = requestAnimationFrame(() => {
      if (lastEvent.kind === 'ready') {
        const a = useAnalysis.getState().analyses.byAttempt[attempt.id];
        const high = a ? Object.values(a.derived.priorities).filter((p) => p.level === 'alta').length : 0;
        setAnnounce(es.ai.ready(high));
        summaryRef.current?.focus();
      } else if (lastEvent.kind === 'error') {
        setAnnounce(useAnalysis.getState().requests[attempt.id]?.error?.message ?? '');
        errorRef.current?.focus();
      } else {
        setAnnounce('Análisis cancelado.');
        analyzeRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [lastEvent, attempt.id]);

  const doStart = (regenerate = false) => start(attempt, bank, { regenerate });

  let content: JSX.Element;
  if (kind === 'no_errors') content = <NoErrorsPanel attempt={attempt} bank={bank} progress={progress} />;
  else if (kind === 'all_omitted') content = <AllOmittedPanel attempt={attempt} bank={bank} />;
  else if (view && analysis) {
    content = (
      <>
        {request?.status === 'loading' && <LoadingPanel request={request} attempt={attempt} onCancel={() => cancel(attempt.id)} compact />}
        {request?.status === 'error' && <ErrorPanel request={request} headingRef={errorRef} onRetry={() => doStart(true)} resultHref={resultHref} regenerate />}
        <PlanContent
          view={view}
          analysis={analysis}
          attempt={attempt}
          bank={bank}
          summaryRef={summaryRef}
          canRegenerate={!view.readOnly && access.kind === 'ready' && kind === 'ok' && request?.status !== 'loading'}
          onRegenerate={() => setConfirmRegen(true)}
        />
      </>
    );
  } else if (request?.status === 'loading') content = <LoadingPanel request={request} attempt={attempt} onCancel={() => cancel(attempt.id)} />;
  else if (request?.status === 'error') content = <ErrorPanel request={request} headingRef={errorRef} onRetry={() => doStart()} resultHref={resultHref} />;
  else if (kind === 'not_analyzable') content = <p className="notice warning">{es.ai.notAnalyzable}</p>;
  else content = <IdlePanel access={access} attempt={attempt} analyzeRef={analyzeRef} incompatible={incompatible} onAnalyze={() => doStart()} />;

  return (
    <div className="page">
      <header className="page-head">
        <Link to={resultHref} className={s.back}>
          <ArrowLeft size={18} aria-hidden="true" /> Resultado del examen
        </Link>
        <h1 tabIndex={-1}>{es.ai.planTitle}</h1>
        <p className={s.meta}>
          {formatDate(attempt.finishedAt)} · {configSourceLabel(attempt.config)}
        </p>
      </header>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      {content}
      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="¿Regenerar el análisis?"
        role="alertdialog"
        actions={
          <>
            <Button onClick={() => setConfirmRegen(false)}>{es.common.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmRegen(false);
                doStart(true);
              }}
            >
              Regenerar
            </Button>
          </>
        }
      >
        <p>{es.ai.regenerateConfirm}</p>
        <p className="small muted">El plan actual se sigue mostrando hasta que el nuevo termine bien.</p>
      </Dialog>
    </div>
  );
}

function IdlePanel({ access, attempt, analyzeRef, incompatible, onAnalyze }: { access: AiAccess; attempt: ExamAttempt; analyzeRef: RefObject<HTMLButtonElement>; incompatible: boolean; onAnalyze(): void }) {
  const c = attemptCounts(attempt);
  const scorable = c.correct + c.incorrect + c.omitted;
  const mostlyOmitted = scorable > 0 && c.omitted / scorable >= 0.5;
  return (
    <section className={`card ${s.neutral}`} aria-labelledby="idle-h">
      <h2 id="idle-h" className={s.withIcon}>
        <Sparkles size={20} aria-hidden="true" /> {es.ai.entryTitle}
      </h2>
      {incompatible && <p className="notice warning">{es.ai.incompatible}</p>}
      {access.kind === 'checking' && (
        <p className="muted" aria-busy="true">
          {es.ai.checking}
        </p>
      )}
      {access.kind === 'no_endpoint' && <p>{es.ai.notInstalled}</p>}
      {access.kind === 'not_configured' && <p>{es.ai.notConfigured}</p>}
      {access.kind === 'needs_token' && (
        <>
          <p>{es.ai.needsToken}</p>
          <div>
            <ButtonLink to="/ajustes#ia" icon={<SettingsIcon size={18} aria-hidden="true" />}>
              {es.ai.goSettings}
            </ButtonLink>
          </div>
        </>
      )}
      {access.kind === 'ready' && (
        <>
          <p>{es.ai.entryLead}</p>
          <p className="small muted">{es.ai.entryPrivacy}</p>
          {mostlyOmitted && (
            <p className="notice info">
              Dejaste {c.omitted} de {scorable} sin responder. Las omitidas no dicen qué sabés: el plan se apoya sobre todo en las {c.incorrect} que respondiste mal.
            </p>
          )}
          {access.provider === 'mock' && <p className="small">{es.ai.mockBanner}.</p>}
          <div className={s.entryActions}>
            <Button ref={analyzeRef} variant="primary" className={s.entryBtn} icon={<Sparkles size={18} aria-hidden="true" />} onClick={onAnalyze}>
              {es.ai.analyze}
            </Button>
          </div>
        </>
      )}
      <p className="small muted">{es.ai.gradeUnchanged}</p>
    </section>
  );
}

function LoadingPanel({ request, attempt, onCancel, compact }: { request: RequestState; attempt: ExamAttempt; onCancel(): void; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className={`card ${s.neutral}`} aria-busy="true" aria-labelledby="loading-h">
      <h2 id="loading-h" className={s.withIcon}>
        <RefreshCw size={20} aria-hidden="true" className={s.spin} /> {compact ? 'Regenerando el análisis…' : es.ai.analyzing}
      </h2>
      <p>
        {es.ai.analyzingLong}{' '}
        <span className="num" aria-hidden="true">
          {formatDuration(now - request.startedAt)}
        </span>
      </p>
      {compact && <p className="small muted">El plan actual se sigue mostrando hasta que el nuevo termine bien.</p>}
      <div className="row">
        <Button onClick={onCancel}>{es.common.cancel}</Button>
        <ButtonLink to={`/examen/resultado/${attempt.id}`} variant="ghost">
          Ver resultado
        </ButtonLink>
        {attempt.items.length > 0 && (
          <ButtonLink to={`/examen/resultado/${attempt.id}/revision/1`} variant="ghost">
            Revisar todas
          </ButtonLink>
        )}
      </div>
      {!compact && <StudyPlanSkeleton />}
    </section>
  );
}

function ErrorPanel({ request, headingRef, onRetry, resultHref, regenerate }: { request: RequestState; headingRef: RefObject<HTMLHeadingElement>; onRetry(): void; resultHref: string; regenerate?: boolean }) {
  const err = request.error!;
  const [now, setNow] = useState(Date.now());
  const waitUntil = err.retryAfterSec ? request.startedAt + err.retryAfterSec * 1000 : 0;
  const left = Math.max(0, Math.ceil((waitUntil - now) / 1000));
  useEffect(() => {
    if (!waitUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitUntil]);
  return (
    <section className={`card ${s.error}`} role="alert" aria-labelledby="err-h">
      <h2 id="err-h" ref={headingRef} tabIndex={-1} className={s.withIcon}>
        <TriangleAlert size={20} aria-hidden="true" /> {regenerate ? 'No se pudo regenerar el plan' : 'No se pudo generar el plan'}
      </h2>
      <p>{err.message}</p>
      <p className="small">{regenerate ? 'Se conserva el plan anterior. ' : 'No se guardó nada. '}{es.ai.gradeUnchanged}</p>
      <div className="row">
        {err.retryable && (
          <Button variant="primary" onClick={onRetry} disabled={left > 0} icon={<RotateCcw size={18} aria-hidden="true" />}>
            {left > 0 ? `Reintentar en ${formatDuration(left * 1000)}` : es.common.retry}
          </Button>
        )}
        {err.code === 'unauthorized' && (
          <ButtonLink to="/ajustes#ia" icon={<SettingsIcon size={18} aria-hidden="true" />}>
            {es.ai.goSettings}
          </ButtonLink>
        )}
        <ButtonLink to={resultHref} icon={<Undo2 size={18} aria-hidden="true" />}>
          Volver al resultado
        </ButtonLink>
      </div>
    </section>
  );
}

function AllOmittedPanel({ attempt, bank }: { attempt: ExamAttempt; bank: LoadedBank }) {
  const c = attemptCounts(attempt);
  const first = firstInBankOrder(
    attempt.items.filter((i) => i.result !== 'correct').map((i) => i.questionId),
    bank,
  );
  return (
    <section className={`card ${s.neutral}`} aria-labelledby="omit-h">
      <h2 id="omit-h">No hay respuestas incorrectas para analizar</h2>
      <p>
        Dejaste {c.omitted} de {c.total} sin responder. Las omitidas no dicen qué sabés, así que no se llama a la IA.
      </p>
      <div className="row">
        {first && (
          <ButtonLink to={practiceUrl(first, { list: `attempt:${attempt.id}` })} variant="primary" icon={<RotateCcw size={18} aria-hidden="true" />}>
            Repasar las omitidas
          </ButtonLink>
        )}
        <ButtonLink to={`/examen/resultado/${attempt.id}`}>Volver al resultado</ButtonLink>
      </div>
    </section>
  );
}

function PracticeButtons({ view, attempt, bank }: { view: PlanView; attempt: ExamAttempt; bank: LoadedBank }) {
  // la lista de práctica va en orden del banco: se entra por su primera pregunta
  const firstWrong = firstInBankOrder(
    attempt.items.filter((i) => i.result !== 'correct').map((i) => i.questionId),
    bank,
  );
  const firstPractice = firstInBankOrder(view.practiceIds, bank);
  return (
    <div className={s.mainActions}>
      {firstWrong && (
        <ButtonLink to={practiceUrl(firstWrong, { list: `attempt:${attempt.id}` })} variant="primary" icon={<RotateCcw size={18} aria-hidden="true" />}>
          Repasar mis errores ({view.reviewCount})
        </ButtonLink>
      )}
      {firstPractice ? (
        <ButtonLink to={planPracticeUrl(firstPractice, attempt.id)} icon={<Play size={18} aria-hidden="true" />}>
          Practicar estos temas ({view.practiceIds.length})
        </ButtonLink>
      ) : (
        <p className="small muted">{es.ai.noPracticeCandidates}</p>
      )}
    </div>
  );
}

function PlanContent({
  view,
  analysis,
  attempt,
  bank,
  summaryRef,
  canRegenerate,
  onRegenerate,
}: {
  view: PlanView;
  analysis: StoredAnalysis;
  attempt: ExamAttempt;
  bank: LoadedBank;
  summaryRef: RefObject<HTMLHeadingElement>;
  canRegenerate: boolean;
  onRegenerate(): void;
}) {
  const allConcepts = view.groups.flatMap((g) => g.concepts);
  const firstHigh = view.groups.find((g) => g.level === 'alta')?.concepts[0]?.concept.id;
  const [open, setOpen] = useState<Set<string>>(() => new Set(firstHigh ? [firstHigh] : []));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const c = view.counts;
  const cov = view.coverage;
  const hasStrengths = view.chapterStrengths.length > 0 || view.improvedCount > 0 || view.aiStrengths.length > 0;

  return (
    <div className={s.plan}>
      <AiGenerated variant="banner" label={view.provider === 'mock' ? es.ai.mockBanner : es.ai.pageBanner}>
        <p className="small muted">
          {view.provider === 'mock' ? 'Proveedor simulado (sin IA real).' : `Modelo: ${view.model}.`} Generado el {formatDate(view.createdAt)}.
          {view.oldBank && !view.readOnly && (
            <>
              {' '}
              <span className="chip warning">Banco anterior</span>
            </>
          )}
        </p>
        {view.olderPrompt && <p className="small">{es.ai.olderPrompt}</p>}
      </AiGenerated>

      {view.readOnly && (
        <p className="notice warning">
          <TriangleAlert size={18} aria-hidden="true" />
          <span>
            {view.changedCount === 1 ? 'Una pregunta de este intento cambió' : `${view.changedCount} preguntas de este intento cambiaron`} en el banco. El plan se muestra en solo lectura y esas preguntas no
            entran en las prácticas.
          </span>
        </p>
      )}

      <section className={s.computed} aria-labelledby="calc-h">
        <h2 id="calc-h" className={s.computedTitle}>
          {es.ai.computed}
        </h2>
        <p className="num">
          {c.correct} de {c.total} correctas · {c.incorrect} {c.incorrect === 1 ? 'incorrecta' : 'incorrectas'} · {c.omitted} {c.omitted === 1 ? 'omitida' : 'omitidas'}
        </p>
        <p className="small">
          {cov.failedAnalyzed === cov.failed ? `Se analizaron en detalle tus ${cov.failed} errores.` : `Se analizaron en detalle ${cov.failedAnalyzed} de tus ${cov.failed} errores.`}
        </p>
        {cov.notScored > 0 && <p className="small">{cov.notScored === 1 ? '1 pregunta no puntuable de este intento quedó fuera del análisis.' : `${cov.notScored} preguntas no puntuables de este intento quedaron fuera del análisis.`}</p>}
        {view.mostlyOmitted && (
          <p className="small">
            Dejaste {c.omitted} de {c.correct + c.incorrect + c.omitted} sin responder. Las omitidas no dicen qué sabés: el plan se apoya sobre todo en las {c.incorrect} que respondiste mal.
          </p>
        )}
      </section>

      <AiGenerated
        heading={
          <h2 ref={summaryRef} tabIndex={-1} className={s.summaryTitle}>
            Resumen
          </h2>
        }
      >
        <AiText>{view.summary}</AiText>
      </AiGenerated>

      <PracticeButtons view={view} attempt={attempt} bank={bank} />

      {allConcepts.length === 0 ? (
        <section className="stack" aria-labelledby="nopattern-h">
          <h2 id="nopattern-h">{es.ai.noPattern}</h2>
        </section>
      ) : (
        <>
          <div className={s.toggles} role="group" aria-label="Tarjetas de conceptos">
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set(allConcepts.map((k) => k.concept.id)))}>
              Abrir todas
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(new Set())}>
              Cerrar todas
            </Button>
          </div>
          {view.groups.map((g) => (
            <section key={g.level} className={s.group} aria-labelledby={`lvl-${g.level}`}>
              <h2 id={`lvl-${g.level}`}>
                {LEVEL_TITLE[g.level]} ({g.concepts.length})
              </h2>
              {g.concepts.map((k) => {
                const firstP = firstInBankOrder(k.practiceIds, bank);
                return (
                  <ConceptCard
                    key={k.concept.id}
                    concept={k.concept}
                    level={k.priority.level}
                    chapterLabel={k.chapterLabel}
                    chapterIsBank={k.chapterIsBank}
                    countsText={k.countsText}
                    recurrent={k.recurrent}
                    limitedEvidence={k.limited}
                    whyText={k.whyText}
                    expanded={open.has(k.concept.id)}
                    onToggle={() => toggle(k.concept.id)}
                    evidence={k.evidence.map((e, i) => (
                      <Evidence key={e.id} e={e} open={i === 0} />
                    ))}
                    practice={
                      firstP ? (
                        <ButtonLink to={planPracticeUrl(firstP, attempt.id, k.concept.id)} icon={<Play size={18} aria-hidden="true" />}>
                          Practicar este tema ({k.practiceIds.length})
                        </ButtonLink>
                      ) : undefined
                    }
                  />
                );
              })}
            </section>
          ))}
        </>
      )}

      {view.unassigned.length > 0 && (
        <section className={s.group} aria-labelledby="unassigned-h">
          <h2 id="unassigned-h">Otros errores sin agrupar ({view.unassigned.length})</h2>
          {view.notDetailed > 0 && <p className="small muted">Incluye {view.notDetailed} que no se analizaron en detalle.</p>}
          <div className="stack-sm">
            {view.unassigned.map((e) => (
              <Evidence key={e.id} e={e} withNote={false} />
            ))}
          </div>
        </section>
      )}

      {hasStrengths && (
        <section className={s.group} aria-labelledby="strengths-h">
          <h2 id="strengths-h">Fortalezas observadas</h2>
          <ul role="list" className={s.plainList}>
            {view.chapterStrengths.map((cs) => (
              <li key={cs.label} className={s.strength}>
                <span className="chip">Calculado</span>{' '}
                <span>
                  <span lang="en">{cs.label}</span>: {cs.correct} de {cs.total} correctas en este intento.
                </span>
              </li>
            ))}
            {view.improvedCount > 0 && (
              <li className={s.strength}>
                <span className="chip">Calculado</span> <span>Acertaste {view.improvedCount === 1 ? '1 pregunta que habías fallado antes' : `${view.improvedCount} preguntas que habías fallado antes`}.</span>
              </li>
            )}
          </ul>
          {view.aiStrengths.length > 0 && (
            <AiGenerated label="Fortalezas según la IA">
              <ul className={s.aiList}>
                {view.aiStrengths.map((st, i) => (
                  <li key={i}>
                    {st.name} · {st.n} preguntas acertadas
                  </li>
                ))}
              </ul>
            </AiGenerated>
          )}
        </section>
      )}

      {view.keyFlags.length > 0 && (
        <section className={s.group} aria-labelledby="flags-h">
          <h2 id="flags-h">Para revisar: posibles inconsistencias señaladas por la IA ({view.keyFlags.length})</h2>
          <p className="small">{es.ai.keyFlagsNote}</p>
          {view.keyFlags.map((f) => (
            <div key={f.evidence.id} className="stack-sm">
              <AiGenerated label="Nota de la IA">
                <AiText>{f.note}</AiText>
              </AiGenerated>
              <Evidence e={f.evidence} withNote={false} />
            </div>
          ))}
        </section>
      )}

      <PracticeButtons view={view} attempt={attempt} bank={bank} />

      <footer className={s.footer}>
        <p className="small muted">{es.ai.priorityFooter}</p>
        <p className="small muted">Prioridades calculadas con tu historial al {formatDate(analysis.createdAt)}.</p>
        <div className="row">
          {canRegenerate && (
            <Button onClick={onRegenerate} icon={<RefreshCw size={18} aria-hidden="true" />}>
              Regenerar análisis
            </Button>
          )}
          <ButtonLink to={`/examen/resultado/${attempt.id}`} icon={<Undo2 size={18} aria-hidden="true" />}>
            Volver al resultado
          </ButtonLink>
          <ButtonLink to={`/examen/resultado/${attempt.id}/revision/1`} variant="ghost" icon={<ListChecks size={18} aria-hidden="true" />}>
            Revisar todas
          </ButtonLink>
        </div>
      </footer>
    </div>
  );
}
