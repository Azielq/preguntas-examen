import { Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LoadedBank } from '../../bank/types';
import { es, formatDate } from '../../i18n/es';
import { useAnalysis } from '../../state/analysisStore';
import { useProgress } from '../../state/progressStore';
import type { ExamAttempt } from '../../storage/schema';
import { Button, ButtonLink } from '../../ui/Button/Button';
import { Skeleton } from '../../ui/States/States';
import { buildAnalyzeRequest } from './analysisData';
import { analysisPlanPath } from './analysisPaths';
import s from './StudyPlan.module.css';
import { useAiAccess } from './useAiAvailability';

/** Tarjeta de entrada en Resultado (PLAN-IA 9.1, 9.3). El resultado convencional no cambia. */
export function AiAnalysisEntry({ attempt, bank }: { attempt: ExamAttempt; bank: LoadedBank }) {
  const navigate = useNavigate();
  const access = useAiAccess();
  const analysis = useAnalysis((st) => st.analyses.byAttempt[attempt.id]);
  const request = useAnalysis((st) => st.requests[attempt.id]);
  const start = useAnalysis((st) => st.start);
  const progress = useProgress((st) => st.state);
  const planHref = analysisPlanPath(attempt.id);
  const kind = buildAnalyzeRequest(attempt, bank, progress).kind;

  let body: JSX.Element;
  if (analysis) {
    const high = Object.values(analysis.derived.priorities).filter((p) => p.level === 'alta').length;
    body = (
      <div className={s.entryRow}>
        <p>
          Plan generado el {formatDate(analysis.createdAt)} · {high} {high === 1 ? 'tema' : 'temas'} de prioridad alta
        </p>
        <ButtonLink to={planHref} variant="primary" icon={<Sparkles size={18} aria-hidden="true" />}>
          {es.ai.viewPlan}
        </ButtonLink>
      </div>
    );
  } else if (request?.status === 'loading') {
    body = (
      <div className={s.entryRow} aria-busy="true">
        <p>{es.ai.analyzing}</p>
        <ButtonLink to={planHref}>{es.ai.viewProgress}</ButtonLink>
      </div>
    );
  } else if (kind === 'no_errors' || kind === 'all_omitted') {
    body = (
      <div className={s.entryRow}>
        <p>{kind === 'no_errors' ? 'Sin errores en este intento: no hace falta un análisis con IA.' : 'No hay respuestas incorrectas para analizar.'}</p>
        <ButtonLink to={planHref}>{kind === 'no_errors' ? 'Ver cómo consolidar' : 'Ver opciones de repaso'}</ButtonLink>
      </div>
    );
  } else if (kind === 'not_analyzable') {
    body = <p className="muted">{es.ai.notAnalyzable}</p>;
  } else if (access.kind === 'checking') {
    body = (
      <div aria-busy="true">
        <span className="sr-only">{es.ai.checking}</span>
        <Skeleton lines={1} />
      </div>
    );
  } else if (access.kind === 'no_endpoint') {
    body = <p className="muted">{es.ai.notInstalled}</p>;
  } else if (access.kind === 'not_configured') {
    body = <p className="muted">{es.ai.notConfigured}</p>;
  } else if (access.kind === 'needs_token') {
    body = (
      <div className={s.entryRow}>
        <p>{es.ai.needsToken}</p>
        <ButtonLink to="/ajustes#ia" icon={<SettingsIcon size={18} aria-hidden="true" />}>
          {es.ai.goSettings}
        </ButtonLink>
      </div>
    );
  } else {
    body = (
      <>
        <p>{es.ai.entryLead}</p>
        <p className="small muted">{es.ai.entryPrivacy}</p>
        {access.provider === 'mock' && <p className="small">{es.ai.mockBanner}.</p>}
        <div className={s.entryActions}>
          <Button
            variant="primary"
            className={s.entryBtn}
            icon={<Sparkles size={18} aria-hidden="true" />}
            onClick={() => {
              start(attempt, bank);
              navigate(planHref);
            }}
          >
            {es.ai.analyze}
          </Button>
        </div>
      </>
    );
  }

  return (
    <section className={`card ${s.entry}`} aria-labelledby="ai-entry-h">
      <h2 id="ai-entry-h" className={s.entryTitle}>
        <Sparkles size={20} strokeWidth={1.75} aria-hidden="true" /> {es.ai.entryTitle}
      </h2>
      {body}
    </section>
  );
}
