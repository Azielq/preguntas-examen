import { Play, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { docShort, groupSections } from '../../bank/selectors';
import { buildExam, examCandidates } from '../../grading/buildExam';
import { isScorable } from '../../grading/grade';
import type { ExamConfig } from '../../grading/types';
import { es, formatDuration } from '../../i18n/es';
import { useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { PageHeader } from '../app/PageHeader';
import s from './Exam.module.css';

const PRESETS = [10, 25, 45, 90];

export function sourceLabel(src: ExamConfig['source']): string {
  return src === 'both' ? 'Ambos documentos' : docShort(src);
}

export function ExamSetup() {
  const bank = useBank();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const active = useExam((st) => st.active);
  const startExam = useExam((st) => st.start);
  const discard = useExam((st) => st.discard);
  const last = usePrefs((st) => st.prefs.lastExamConfig);
  const setPrefs = usePrefs((st) => st.set);

  const origin = sp.get('origen');
  const initialSource: ExamConfig['source'] = origin === 'gorgotsias' || origin === 'messer' ? origin : (last?.source ?? 'both');
  const [source, setSource] = useState<ExamConfig['source']>(initialSource);
  const [sections, setSections] = useState<string[]>(origin ? [] : (last?.sections ?? []));
  const [preset, setPreset] = useState<number | 'other'>(last && PRESETS.includes(last.count) ? last.count : last ? 'other' : 45);
  const [other, setOther] = useState<string>(last && !PRESETS.includes(last.count) ? String(last.count) : '');
  const [useTimer, setUseTimer] = useState(last ? last.timerMinutes !== null : true);
  const [minutes, setMinutes] = useState<string>(last?.timerMinutes ? String(last.timerMinutes) : '45');
  const [minutesEdited, setMinutesEdited] = useState(!!last?.timerMinutes && last.timerMinutes !== last.count);
  const [includeAi, setIncludeAi] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const scopeSections = bank.manifest.sections.filter((x) => source === 'both' || x.doc === source);
  const validSections = sections.filter((x) => scopeSections.some((y) => y.section === x));
  const scope = { source, sections: validSections.length > 0 ? validSections : undefined, includeAiProposed: includeAi };
  const available = useMemo(
    () => examCandidates(bank.questions, bank.indexes.units, bank.indexes.byId, scope).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bank, source, validSections.join(','), includeAi],
  );
  const availableFor = (src: ExamConfig['source']) =>
    examCandidates(bank.questions, bank.indexes.units, bank.indexes.byId, { source: src, includeAiProposed: includeAi }).length;
  const scopeQs = bank.questions.filter((q) => (source === 'both' || q.doc === source) && (!scope.sections || scope.sections.includes(q.section)));
  const hasMultiple = scopeQs.some((q) => q.selectionType === 'multiple' && isScorable(q));
  const aiCount = scopeQs.filter((q) => q.answerStatus === 'ai_proposed' && isScorable(q)).length;
  const pendingCount = scopeQs.filter((q) => !isScorable(q)).length;

  const count = preset === 'other' ? Number(other) : preset;
  const countError =
    preset === 'other' && (!Number.isInteger(count) || count < 1 || count > available) ? `Ingresá un número entero entre 1 y ${available}.` : null;
  const effectiveCount = preset === 'other' ? count : Math.min(preset, available);
  const minutesNum = Number(minutes);
  const minutesError = useTimer && (!Number.isInteger(minutesNum) || minutesNum < 1 || minutesNum > 600) ? 'Ingresá minutos entre 1 y 600.' : null;
  const canStart = !active && available > 0 && !countError && !minutesError && (preset === 'other' || preset <= available);

  const onCount = (p: number | 'other', otherVal = other) => {
    setPreset(p);
    if (!minutesEdited) {
      const n = p === 'other' ? Number(otherVal) : p;
      if (Number.isInteger(n) && n > 0) setMinutes(String(Math.min(600, n)));
    }
  };

  const start = () => {
    if (!canStart) return;
    const config: ExamConfig = {
      source,
      sections: scope.sections,
      count: effectiveCount,
      timerMinutes: useTimer ? minutesNum : null,
      includeAiProposed: includeAi,
    };
    const items = buildExam(bank.questions, bank.indexes.units, bank.indexes.byId, config);
    startExam(config, items, bank.manifest.bankVersion);
    setPrefs({ lastExamConfig: config });
    navigate('/examen/en-curso');
  };

  const groups = groupSections(scopeSections);
  const answeredActive = active ? active.items.filter((i) => i.selected.length > 0).length : 0;

  return (
    <div className="page">
      <PageHeader title={es.nav.exam} docTitle={es.nav.exam} description="Simulá un examen. Las respuestas se muestran recién al finalizar." />

      {active && (
        <section className={`card ${s.resume}`} aria-labelledby="exam-resume">
          <div className="stack-sm">
            <h2 id="exam-resume" className="card-title">
              Tenés un examen sin terminar
            </h2>
            <p className="num">
              {answeredActive} de {active.items.length} respondidas
              {active.remainingMs !== null && `, quedan ${formatDuration(active.remainingMs)}`}.
            </p>
            {active.remainingMs !== null && <p className="small muted">El tiempo se pausó al salir.</p>}
          </div>
          <div className="row">
            <Button variant="primary" icon={<Play size={18} aria-hidden="true" />} onClick={() => navigate('/examen/en-curso')}>
              Reanudar
            </Button>
            <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={() => setConfirmDiscard(true)}>
              Descartar
            </Button>
          </div>
        </section>
      )}

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        <fieldset className={`card ${s.box}`}>
          <legend className={s.legend}>Origen</legend>
          {(['both', 'gorgotsias', 'messer'] as const).map((src) => (
            <label key={src} className={`check ${s.optRow}`}>
              <input
                type="radio"
                name="source"
                value={src}
                checked={source === src}
                onChange={() => {
                  setSource(src);
                  setSections([]);
                }}
              />
              <span className={s.optLabel}>{sourceLabel(src)}</span>
              <span className="muted num">
                {availableFor(src)}
                {src === 'both' ? ' preguntas distintas disponibles' : ''}
              </span>
            </label>
          ))}
          <details className={s.details}>
            <summary>Limitar a secciones {validSections.length > 0 && `(${validSections.length} elegidas)`}</summary>
            <div className="stack">
              {groups.map((g) => (
                <fieldset key={g.key}>
                  <legend className="field-label">{g.label}</legend>
                  <div className={s.secGrid}>
                    {g.sections.map((x) => (
                      <label key={x.section} className="check">
                        <input
                          type="checkbox"
                          checked={validSections.includes(x.section)}
                          onChange={(e) =>
                            setSections((cur) => (e.target.checked ? [...cur.filter((y) => y !== x.section), x.section] : cur.filter((y) => y !== x.section)))
                          }
                        />
                        <span lang="en">{x.topic}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {validSections.length > 0 && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setSections([])}>
                    Usar todas las secciones
                  </Button>
                </div>
              )}
            </div>
          </details>
          <p className="small muted num">Disponibles con esta selección: {available}</p>
        </fieldset>

        <fieldset className={`card ${s.box}`}>
          <legend className={s.legend}>Cantidad de preguntas</legend>
          <div className="radio-list">
            {PRESETS.map((n) => {
              const dis = n > available;
              return (
                <label key={n} className="check" aria-disabled={dis || undefined}>
                  <input type="radio" name="count" checked={preset === n} disabled={dis} onChange={() => onCount(n)} aria-describedby={dis ? `cnt-${n}-why` : undefined} />
                  <span className="num">{n}</span>
                  {dis && (
                    <span id={`cnt-${n}-why`} className="small muted">
                      (solo hay {available} disponibles)
                    </span>
                  )}
                </label>
              );
            })}
            <label className="check">
              <input type="radio" name="count" checked={preset === 'other'} onChange={() => onCount('other')} />
              Otra:
            </label>
            <span className="row">
              <label htmlFor="count-other" className="sr-only">
                Cantidad personalizada
              </label>
              <input
                id="count-other"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={available}
                value={other}
                onChange={(e) => {
                  setOther(e.target.value);
                  onCount('other', e.target.value);
                }}
                aria-invalid={!!countError || undefined}
                aria-describedby="count-other-err count-max"
              />
              <span id="count-max" className="small muted">
                (máx. {available})
              </span>
            </span>
          </div>
          <p id="count-other-err" className="field-error" aria-live="polite">
            {countError ?? ''}
          </p>
        </fieldset>

        <fieldset className={`card ${s.box}`}>
          <legend className={s.legend}>Tiempo</legend>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={useTimer} onChange={(e) => setUseTimer(e.target.checked)} />
              Usar temporizador
            </label>
            {useTimer && (
              <span className="row">
                <label htmlFor="minutes" className="field-label">
                  Minutos:
                </label>
                <input
                  id="minutes"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={600}
                  value={minutes}
                  onChange={(e) => {
                    setMinutes(e.target.value);
                    setMinutesEdited(true);
                  }}
                  aria-invalid={!!minutesError || undefined}
                  aria-describedby="minutes-err minutes-help"
                />
                <span id="minutes-help" className="small muted">
                  (por defecto, 1 minuto por pregunta)
                </span>
              </span>
            )}
          </div>
          <p id="minutes-err" className="field-error" aria-live="polite">
            {minutesError ?? ''}
          </p>
        </fieldset>

        <section className={`card ${s.box}`} aria-labelledby="exam-includes">
          <h2 id="exam-includes" className={s.legend}>
            Qué incluye
          </h2>
          <ul className={s.bullets}>
            <li>Orden de preguntas al azar; las opciones mantienen su orden.</li>
            <li>Las preguntas repetidas entre capítulos y simuladores aparecen una sola vez.</li>
            {pendingCount > 0 && <li>Se excluyen las {pendingCount} preguntas pendientes de revisión.</li>}
            {hasMultiple && <li>La pregunta de selección múltiple puntúa todo o nada.</li>}
            <li>No hay veredicto de aprobado o desaprobado: la nota es el porcentaje de aciertos.</li>
          </ul>
          {aiCount > 0 && (
            <label className="check">
              <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} />
              Incluir respuestas propuestas por IA ({aiCount})
            </label>
          )}
        </section>

        <div className={s.startRow}>
          {active && <p className="small muted">Terminá o descartá el examen en curso para empezar otro.</p>}
          {available === 0 && <p className="small muted">No hay preguntas puntuables con esta selección.</p>}
          <Button type="submit" variant="primary" size="lg" disabled={!canStart} icon={<Play size={18} aria-hidden="true" />}>
            Empezar examen
          </Button>
        </div>
      </form>

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="¿Descartar el examen en curso?"
        role="alertdialog"
        actions={
          <>
            <Button onClick={() => setConfirmDiscard(false)}>{es.common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                discard();
                setConfirmDiscard(false);
              }}
            >
              Descartar
            </Button>
          </>
        }
      >
        <p>Se pierden las {answeredActive} respuestas de este examen. No queda en el historial.</p>
      </Dialog>
    </div>
  );
}

