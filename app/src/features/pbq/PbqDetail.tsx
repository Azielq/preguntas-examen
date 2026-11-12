import { ArrowLeft, ArrowRight, FileImage, Info } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { assetUrl } from '../../bank/loadBank';
import { ButtonLink } from '../../ui/Button/Button';
import { ImageViewer } from '../../ui/ImageViewer/ImageViewer';
import { ErrorState, LoadingRegion, Skeleton } from '../../ui/States/States';
import { NotFound } from '../app/NotFound';
import { PageHeader } from '../app/PageHeader';
import s from './Pbq.module.css';
import { usePbq } from './usePbq';

export function PbqDetail() {
  const { pbqId = '' } = useParams();
  const { pbq, status, retry } = usePbq();
  if (status === 'error') return <ErrorState title="No se pudieron cargar las soluciones PBQ." onRetry={retry} />;
  if (!pbq)
    return (
      <LoadingRegion>
        <Skeleton lines={6} />
      </LoadingRegion>
    );
  const i = pbq.findIndex((p) => p.id === pbqId);
  const p = pbq[i];
  if (!p) return <NotFound title="No encontramos esa PBQ" />;
  const prev = pbq[i - 1];
  const next = pbq[i + 1];
  return (
    <div className="page">
      <div className="row-between">
        <Link to="/pbq" className={s.back}>
          <ArrowLeft size={18} aria-hidden="true" /> Referencia PBQ
        </Link>
        <div className="row">
          {prev && (
            <ButtonLink to={`/pbq/${prev.id}`} icon={<ArrowLeft size={18} aria-hidden="true" />}>
              {prev.originalLabel} anterior
            </ButtonLink>
          )}
          {next && (
            <ButtonLink to={`/pbq/${next.id}`} iconRight={<ArrowRight size={18} aria-hidden="true" />}>
              Siguiente: {next.originalLabel}
            </ButtonLink>
          )}
        </div>
      </div>
      <PageHeader title={`PBQ ${p.originalLabel}`} docTitle={`PBQ ${p.originalLabel}`}>
        <span className="chip info" style={{ width: 'fit-content' }}>
          <FileImage size={16} aria-hidden="true" /> Solución del PDF — sin puntuación
        </span>
        <p lang="en" className="pdf-text" style={{ color: 'var(--text)' }}>
          {p.title}
        </p>
      </PageHeader>
      <p className="notice info">
        <Info size={18} aria-hidden="true" />
        <span>{p.note}</span>
      </p>
      {p.images.map((img, k) => (
        <section key={img} className="section" aria-label={`Página ${p.pages[k]} del PDF`}>
          <ImageViewer
            src={assetUrl(img)}
            alt={`Página ${p.pages[k]} del PDF de Messer: solución de la PBQ ${p.originalLabel}${p.images.length > 1 ? ` (parte ${k + 1} de ${p.images.length})` : ''}`}
            caption={`Página ${p.pages[k]} del PDF (impresa ${p.printedPages[k]}) · Página ${k + 1} de ${p.images.length}`}
          />
        </section>
      ))}
      <details className="card">
        <summary>Texto extraído de la página</summary>
        <pre lang="en" className={s.pre}>
          {p.text}
        </pre>
      </details>
    </div>
  );
}
