import { ArrowLeft, ArrowRight, FileImage, FileText, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { assetUrl } from '../../bank/loadBank';
import { docShort } from '../../bank/selectors';
import type { PbqSolution } from '../../bank/types';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useQuestionChrome } from '../../hooks/useLayoutMode';
import { Button, ButtonLink } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { ImageViewer } from '../../ui/ImageViewer/ImageViewer';
import { QuestionScreen } from '../../ui/QuestionScreen/QuestionScreen';
import { ErrorState, LoadingRegion, Skeleton } from '../../ui/States/States';
import { NotFound } from '../app/NotFound';
import L from '../common/QuestionLayout.module.css';
import s from './Pbq.module.css';
import { usePbq } from './usePbq';

export interface PbqPage {
  src: string;
  page: number;
  printed: number;
  part: 'question' | 'answer' | 'solution';
  /** otras PBQ que aparecen en la misma imagen */
  sharedWith: string[];
}

/** Páginas de una PBQ en orden: enunciado y solución (libro completo) o solo solución (extracto). */
export function pbqPages(p: PbqSolution, all: PbqSolution[]): PbqPage[] {
  const shared = (img: string) => all.filter((o) => o.id !== p.id && o.images.includes(img)).map((o) => o.originalLabel);
  return p.images.map((img, k) => ({
    src: img,
    page: p.pages[k]!,
    printed: p.printedPages[k]!,
    part: p.questionImages ? (p.questionImages.includes(img) ? 'question' : 'answer') : 'solution',
    sharedWith: shared(img),
  }));
}

const PART_LABEL: Record<PbqPage['part'], string> = { question: 'Enunciado', answer: 'Solución', solution: 'Solución' };

export function PbqDetail() {
  const { pbqId = '' } = useParams();
  const { pbq, status, retry } = usePbq();
  const [page, setPage] = useState(0);
  const [textOpen, setTextOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const chrome = useQuestionChrome();
  useEffect(() => {
    setPage(0);
    setTextOpen(false);
    setDetailOpen(false);
  }, [pbqId]);
  const i = pbq ? pbq.findIndex((p) => p.id === pbqId) : -1;
  const p = pbq?.[i];
  useDocumentTitle(p ? `PBQ ${p.originalLabel} · ${docShort(p.doc)}` : 'PBQ');
  const pages = useMemo(() => (p && pbq ? pbqPages(p, pbq) : []), [p, pbq]);
  if (status === 'error') return <ErrorState title="No se pudieron cargar las soluciones PBQ." onRetry={retry} />;
  if (!pbq)
    return (
      <LoadingRegion>
        <Skeleton lines={6} />
      </LoadingRegion>
    );
  if (!p) return <NotFound title="No encontramos esa PBQ" />;
  const prev = pbq[i - 1];
  const next = pbq[i + 1];
  const cur = pages[Math.min(page, pages.length - 1)]!;
  const doc = docShort(p.doc);
  const caption = [
    `${PART_LABEL[cur.part]} · Página ${cur.page} del PDF (impresa ${cur.printed})`,
    cur.sharedWith.length > 0 ? `La página también contiene la PBQ ${cur.sharedWith.join(', ')}: buscá la ${p.originalLabel}.` : '',
  ]
    .filter(Boolean)
    .join('. ');
  const label = (x: PbqSolution) => (x.doc === p.doc ? x.originalLabel : `${x.originalLabel} (${docShort(x.doc)})`);

  return (
    <>
      <QuestionScreen
        kind="pbq"
        questionKey={p.id}
        fillArea
        articleProps={{ 'aria-label': `PBQ ${p.originalLabel} de ${doc}` }}
        headerTop={
          <>
            <Link to={`/pbq?doc=${p.doc}`} className={L.back} aria-label={chrome.narrow ? 'Volver a Referencia PBQ' : undefined}>
              <ArrowLeft size={18} aria-hidden="true" /> {!chrome.narrow && 'Referencia PBQ'}
            </Link>
            <h1 tabIndex={-1} className={L.title} data-focus-fallback="">
              PBQ {p.originalLabel} <span className="small muted">· {doc}</span>
            </h1>
            <span className="chip info">
              <FileImage size={16} aria-hidden="true" /> {p.questionImages ? 'Enunciado y solución del PDF' : 'Solución del PDF'} — sin puntuación
            </span>
            <Button size="sm" variant="ghost" icon={<Info size={16} aria-hidden="true" />} onClick={() => setDetailOpen(true)} data-action="detail">
              Ver detalle
            </Button>
          </>
        }
        headerQuestion={
          <p lang="en" className={`pdf-text ${s.title}`}>
            {p.title}
          </p>
        }
        actions={{
          left: prev ? (
            <ButtonLink to={`/pbq/${prev.id}`} icon={<ArrowLeft size={18} aria-hidden="true" />} data-action="prev">
              {label(prev)} anterior
            </ButtonLink>
          ) : (
            <span />
          ),
          center: (
            <Button onClick={() => setTextOpen(true)} icon={<FileText size={18} aria-hidden="true" />} data-action="pbq-text">
              Texto extraído
            </Button>
          ),
          right: next ? (
            <ButtonLink to={`/pbq/${next.id}`} iconRight={<ArrowRight size={18} aria-hidden="true" />} data-action="next">
              Siguiente: {label(next)}
            </ButtonLink>
          ) : (
            <span />
          ),
        }}
      >
        <ImageViewer
          key={cur.src}
          fill
          src={assetUrl(cur.src)}
          alt={`Página ${cur.page} del PDF de ${doc}: ${PART_LABEL[cur.part].toLowerCase()} de la PBQ ${p.originalLabel}`}
          caption={caption}
          pager={{ index: page, total: pages.length, onPrev: () => setPage((x) => Math.max(0, x - 1)), onNext: () => setPage((x) => Math.min(pages.length - 1, x + 1)) }}
        />
      </QuestionScreen>
      <Dialog open={textOpen} onClose={() => setTextOpen(false)} title={`Texto extraído · PBQ ${p.originalLabel}`} size="lg" sheet="pbq-text">
        <p className="notice info">
          <Info size={18} aria-hidden="true" />
          <span>Texto extraído literal del PDF. La disposición de la imagen no se conserva.</span>
        </p>
        <pre lang="en" className={s.pre} tabIndex={0}>
          {p.text}
        </pre>
      </Dialog>
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} title={`Detalle · PBQ ${p.originalLabel}`} size="reading" sheet="detail" focusTitle>
        <p>{p.note}</p>
        <p className="small muted">
          {doc} · {pages.length} {pages.length === 1 ? 'página' : 'páginas'}: {pages.map((x) => `${PART_LABEL[x.part].toLowerCase()} pág. ${x.page}`).join(', ')}.
        </p>
      </Dialog>
    </>
  );
}
