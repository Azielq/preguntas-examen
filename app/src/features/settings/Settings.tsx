import { Download, Keyboard, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBank } from '../../bank/BankProvider';
import { questionHeaderLabel } from '../../bank/selectors';
import type { DocId } from '../../bank/types';
import { es } from '../../i18n/es';
import { buildExport, parseImport, type ParsedImport } from '../../storage/exportImport';
import { reconcileMessage } from '../../storage/reconcile';
import { storageAvailable } from '../../storage/storage';
import { useExam } from '../../state/examStore';
import { usePrefs } from '../../state/prefsStore';
import { useProgress } from '../../state/progressStore';
import { toast } from '../../state/toastStore';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { ShortcutsDialog } from '../../ui/ShortcutsDialog/ShortcutsDialog';
import { ThemeRadios } from '../../ui/ThemeToggle/ThemeToggle';
import { PageHeader } from '../app/PageHeader';
import { bankRef } from '../app/bootstrap';
import { usePbq } from '../pbq/usePbq';
import { ImportTable } from './ImportTable';
import s from './Settings.module.css';

export function Settings() {
  const bank = useBank();
  const loc = useLocation();
  const prefs = usePrefs((st) => st.prefs);
  const setPrefs = usePrefs((st) => st.set);
  const replacePrefs = usePrefs((st) => st.replace);
  const progress = useProgress((st) => st.state);
  const replaceProgress = useProgress((st) => st.replace);
  const clearProgress = useProgress((st) => st.clear);
  const attempts = useExam((st) => st.attempts);
  const replaceAttempts = useExam((st) => st.replaceAttempts);
  const clearExams = useExam((st) => st.clearAll);
  const { pbq } = usePbq();
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<Extract<ParsedImport, { ok: true }> | null>(null);
  const [importError, setImportError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const report = bank.manifest.importReport;

  useEffect(() => {
    if (loc.hash) {
      const el = document.getElementById(loc.hash.slice(1));
      el?.scrollIntoView({ block: 'start' });
    }
  }, [loc.hash]);

  const answers = Object.values(progress.questions).filter((p) => p.last).length;
  const pbqCount: Record<DocId, number> | undefined = pbq
    ? { gorgotsias: pbq.filter((p) => p.doc === 'gorgotsias').length, messer: pbq.filter((p) => p.doc === 'messer').length }
    : undefined;

  const doExport = () => {
    const data = buildExport(prefs, progress, attempts);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secplus-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Progreso exportado');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setImportError('');
    const text = await f.text();
    const r = parseImport(text, bankRef(bank));
    if (!r.ok) setImportError(r.error);
    else setPendingImport(r);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="page">
      <PageHeader title={es.nav.settings} docTitle={es.nav.settings} />

      <section id="apariencia" className={`card ${s.section}`} aria-labelledby="h-apariencia">
        <h2 id="h-apariencia">Apariencia</h2>
        <ThemeRadios value={prefs.theme} onChange={(theme) => setPrefs({ theme })} />
        <fieldset>
          <legend className="field-label">Tamaño del texto de las preguntas</legend>
          <div className="radio-list">
            {(
              [
                ['normal', 'Normal'],
                ['large', 'Grande'],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="check">
                <input type="radio" name="textSize" checked={prefs.textSize === v} onChange={() => setPrefs({ textSize: v })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={prefs.singleKeyShortcuts} onChange={(e) => setPrefs({ singleKeyShortcuts: e.target.checked })} />
            Atajos de teclado de una tecla
          </label>
          <Button variant="ghost" size="sm" icon={<Keyboard size={16} aria-hidden="true" />} onClick={() => setHelpOpen(true)}>
            {es.shortcuts.open}
          </Button>
        </div>
      </section>

      <section id="importacion" className={`card ${s.section}`} aria-labelledby="h-importacion">
        <h2 id="h-importacion">Importación del banco</h2>
        <p className="muted num">
          Versión del banco: <code>{bank.manifest.bankVersion}</code> · generado el {bank.manifest.generatedAt}
        </p>
        <ImportTable report={report} extended pbqCount={pbqCount} />
        <p className="small muted">
          {report.identicalDuplicateGroups} grupos de preguntas repetidas ({report.questionsInIdenticalDuplicateGroups} preguntas en esos grupos) ·{' '}
          {bank.indexes.units.size} preguntas distintas. Las explicaciones de IA se muestran rotuladas; las respuestas puntuables provienen del PDF.
        </p>

        <h3>Preguntas pendientes de revisión ({report.pending.length})</h3>
        <p className="small muted">No se corrigen ni cuentan para la nota ni entran en exámenes.</p>
        <ul role="list" className={s.list}>
          {report.pending.map((p) => {
            const q = bank.indexes.byId.get(p.id);
            return (
              <li key={p.id} className={s.item} data-pending-id={p.id}>
                <div className={s.itemHead}>
                  <code>{p.id}</code>
                  <span className="small muted">{q ? questionHeaderLabel(q) : `${p.label} · pág. ${p.page}`}</span>
                  <Link to={`/practica/${p.id}`} className={s.open} aria-label={`Abrir ${p.id}`}>
                    {es.common.open}
                  </Link>
                </div>
                <ul className={s.reasons}>
                  {p.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <details>
          <summary>Notas de extracción ({report.notes.length})</summary>
          <ul role="list" className={s.list}>
            {report.notes.map((n) => (
              <li key={n.id} className={s.item}>
                <div className={s.itemHead}>
                  <code>{n.id}</code>
                  <Link to={`/practica/${n.id}`} className={s.open} aria-label={`Abrir ${n.id}`}>
                    {es.common.open}
                  </Link>
                </div>
                <ul className={s.reasons}>
                  {n.notes.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>

        <h3>Pares duplicados con clave distinta ({report.duplicateAnswerConflicts.length})</h3>
        <ul role="list" className={s.list}>
          {report.duplicateAnswerConflicts.map(([a, b]) => {
            const qa = bank.indexes.byId.get(a);
            const qb = bank.indexes.byId.get(b);
            return (
              <li key={`${a}-${b}`} className={s.item}>
                <div className={s.itemHead}>
                  <span>
                    <code>{a}</code> ({qa?.correct.join(', ')}) ↔ <code>{b}</code> ({qb?.correct.join(', ')}
                    {qb?.review.status === 'pending' ? ', pendiente' : ''})
                  </span>
                  <span className="row">
                    <Link to={`/practica/${a}`} className={s.open} aria-label={`Abrir ${a}`}>
                      Abrir {a}
                    </Link>
                    <Link to={`/practica/${b}`} className={s.open} aria-label={`Abrir ${b}`}>
                      Abrir {b}
                    </Link>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="datos" className={`card ${s.section}`} aria-labelledby="h-datos">
        <h2 id="h-datos">Tus datos</h2>
        <p className="muted">
          {storageAvailable()
            ? 'Se guardan solo en este navegador.'
            : 'Este navegador no permite guardar datos: el progreso vive solo en memoria hasta que cierres la pestaña. Exportalo para no perderlo.'}
        </p>
        <p className="small muted num">
          Ahora: {answers} preguntas respondidas · {attempts.attempts.length} exámenes en el historial.
        </p>
        <div className="row">
          <Button icon={<Download size={18} aria-hidden="true" />} onClick={doExport}>
            Exportar progreso (.json)
          </Button>
          <Button icon={<Upload size={18} aria-hidden="true" />} onClick={() => fileInput.current?.click()}>
            Importar progreso
          </Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={() => setConfirmClear(true)}>
            Borrar todo el progreso
          </Button>
        </div>
        <p className="field-error" role="alert">
          {importError}
        </p>
      </section>

      <Dialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="¿Borrar todo el progreso?"
        role="alertdialog"
        actions={
          <>
            <Button onClick={() => setConfirmClear(false)}>{es.common.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                clearProgress();
                clearExams();
                setConfirmClear(false);
                toast('Progreso borrado');
              }}
            >
              Borrar
            </Button>
          </>
        }
      >
        <p>
          Vas a borrar {answers} respuestas y {attempts.attempts.length} exámenes, además de favoritas, marcas y el examen en curso si lo hay. Las preferencias de
          apariencia se conservan.
        </p>
      </Dialog>

      <Dialog
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        title="¿Reemplazar tu progreso?"
        role="alertdialog"
        actions={
          <>
            <Button onClick={() => setPendingImport(null)}>{es.common.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!pendingImport) return;
                replaceProgress(pendingImport.progress);
                replaceAttempts(pendingImport.attempts);
                replacePrefs(pendingImport.prefs);
                setPendingImport(null);
                toast('Progreso importado');
              }}
            >
              Reemplazar
            </Button>
          </>
        }
      >
        {pendingImport && (
          <>
            <p>
              El archivo tiene {pendingImport.summary.questions} preguntas con progreso y {pendingImport.summary.attempts} exámenes. Va a reemplazar (no fusionar) los{' '}
              {Object.keys(progress.questions).length} registros y {attempts.attempts.length} exámenes actuales.
            </p>
            {reconcileMessage(pendingImport.reconcile) && <p className="small muted">{reconcileMessage(pendingImport.reconcile)}</p>}
          </>
        )}
      </Dialog>
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} singleKeyEnabled={prefs.singleKeyShortcuts} />
    </div>
  );
}
