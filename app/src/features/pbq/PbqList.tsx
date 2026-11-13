import { Network } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { docShort } from '../../bank/selectors';
import { DOC_IDS, type DocId, type PbqSolution } from '../../bank/types';
import { es } from '../../i18n/es';
import { ButtonLink } from '../../ui/Button/Button';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../../ui/States/States';
import { PageHeader } from '../app/PageHeader';
import s from './Pbq.module.css';
import { usePbq } from './usePbq';

function pagesText(printed: number[]): string {
  if (printed.length === 1) return `pág. impresa ${printed[0]}`;
  return `pág. impresas ${printed[0]}–${printed[printed.length - 1]}`;
}

/** "1 página del enunciado · 2 de la solución" (libro completo) o "2 páginas" (extracto: solo solución). */
export function pbqPagesSummary(p: PbqSolution): string {
  if (p.questionImages && p.answerImages) {
    const q = p.questionImages.length;
    const a = p.answerImages.length;
    return `${q} ${q === 1 ? 'página' : 'páginas'} del enunciado · ${a} de la solución`;
  }
  return `${p.images.length} ${p.images.length === 1 ? 'página' : 'páginas'} de la solución`;
}

const DOC_NOTE: Partial<Record<DocId, string>> = {
  messer: 'El extracto trae solo las soluciones de A1–A5 (sin el enunciado interactivo).',
  messerfull: 'El libro completo trae el enunciado y la solución de cada PBQ de los exámenes A, B y C. A veces dos PBQ comparten la misma página.',
};

export function PbqList() {
  const { pbq, status, retry } = usePbq();
  const [sp] = useSearchParams();
  const only = sp.get('doc');
  const docs = DOC_IDS.filter((d) => (!only || only === d) && (pbq ?? []).some((p) => p.doc === d));
  return (
    <div className="page">
      <PageHeader title="Referencia PBQ" docTitle="Referencia PBQ">
        <p>Preguntas prácticas (PBQ) de los dos libros de Messer, como imágenes de página del PDF.</p>
        <p>Son material de consulta: no se responden ni se puntúan. El documento de Gorgotsias no trae PBQ en el banco.</p>
      </PageHeader>
      {status === 'error' && <ErrorState title="No se pudieron cargar las soluciones PBQ." onRetry={retry} />}
      {(status === 'loading' || status === 'idle') && (
        <LoadingRegion>
          <div className="stack">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card">
                <Skeleton lines={2} />
              </div>
            ))}
          </div>
        </LoadingRegion>
      )}
      {status === 'ready' && pbq && pbq.length === 0 && <EmptyState icon={<Network aria-hidden="true" />} title="El banco no tiene soluciones PBQ." />}
      {status === 'ready' && pbq && pbq.length > 0 && (
        <>
          {only && (
            <p>
              <ButtonLink to="/pbq" variant="ghost">
                Ver las PBQ de todos los documentos
              </ButtonLink>
            </p>
          )}
          {docs.map((d) => {
            const list = pbq.filter((p) => p.doc === d);
            return (
              <section key={d} className="section" aria-labelledby={`pbq-${d}`}>
                <div className="stack-sm">
                  <h2 id={`pbq-${d}`}>
                    {docShort(d)} <span className="muted num">({list.length})</span>
                  </h2>
                  {DOC_NOTE[d] && <p className="small muted">{DOC_NOTE[d]}</p>}
                </div>
                <ul role="list" className={s.list}>
                  {list.map((p) => (
                    <li key={p.id} className={`card ${s.item}`}>
                      <h3 className="card-title">
                        {p.originalLabel}
                        <span className="sr-only"> · {docShort(p.doc)}</span>
                      </h3>
                      <p lang="en" className="pdf-text">
                        {p.title}
                      </p>
                      <div className="row-between">
                        <span className="small muted num">
                          {pbqPagesSummary(p)} · {pagesText(p.printedPages)}
                        </span>
                        <ButtonLink to={`/pbq/${p.id}`} aria-label={`${es.common.see} ${p.originalLabel} de ${docShort(p.doc)}`}>
                          {es.common.see}
                        </ButtonLink>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
