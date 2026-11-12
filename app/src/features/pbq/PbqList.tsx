import { Network } from 'lucide-react';
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

export function PbqList() {
  const { pbq, status, retry } = usePbq();
  return (
    <div className="page">
      <PageHeader title="Referencia PBQ" docTitle="Referencia PBQ">
        <p>Soluciones de las preguntas prácticas (PBQ) del extracto de Messer.</p>
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
        <ul role="list" className={s.list}>
          {pbq.map((p) => (
            <li key={p.id} className={`card ${s.item}`}>
              <h2 className="card-title">{p.originalLabel}</h2>
              <p lang="en" className="pdf-text">
                {p.title}
              </p>
              <div className="row-between">
                <span className="small muted num">
                  {p.images.length} {p.images.length === 1 ? 'página' : 'páginas'} · {pagesText(p.printedPages)}
                </span>
                <ButtonLink to={`/pbq/${p.id}`} aria-label={`${es.common.see} ${p.originalLabel}`}>
                  {es.common.see}
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
