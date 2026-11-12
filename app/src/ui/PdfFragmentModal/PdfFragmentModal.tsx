import { Copy, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isImageFragment, type Fragment, type Question } from '../../bank/types';
import { es } from '../../i18n/es';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { LoadingRegion, Skeleton } from '../States/States';
import { ImageViewer } from '../ImageViewer/ImageViewer';
import { TabPanel, Tabs } from '../Tabs/Tabs';
import s from './PdfFragmentModal.module.css';

function pageLabel(page: number, printed: number) {
  return page === printed ? `pág. ${page}` : `pág. PDF ${page}`;
}

export function PdfFragmentModal({
  open,
  onClose,
  question: q,
  fragment,
  allowAnswer,
  onRetry,
  resolveImage,
}: {
  open: boolean;
  onClose(): void;
  question: Question;
  fragment: Fragment | 'loading' | 'error';
  allowAnswer: boolean;
  onRetry(): void;
  resolveImage(path: string): string;
}) {
  const [tab, setTab] = useState<'q' | 'a'>('q');
  const [copied, setCopied] = useState('');
  useEffect(() => {
    if (open) {
      setTab('q');
      setCopied('');
    }
  }, [open, q.id]);
  const qPage = typeof fragment === 'object' ? fragment.questionPage : q.page;
  const aPage = typeof fragment === 'object' ? fragment.answerPage : q.answerSource.page;
  const tabs = [
    { id: 'q', label: es.fragment.tabQuestion(pageLabel(qPage, q.printedPage)) },
    {
      id: 'a',
      label: es.fragment.tabAnswer(pageLabel(aPage, q.answerSource.printedPage)),
      disabled: !allowAnswer,
      hint: es.fragment.answerLocked,
    },
  ];
  const prefix = `frag-${q.id}`;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(es.fragment.copied);
    } catch {
      setCopied('No se pudo copiar el texto.');
    }
  };

  let body: React.ReactNode;
  if (fragment === 'loading') {
    body = (
      <LoadingRegion>
        <Skeleton lines={8} />
      </LoadingRegion>
    );
  } else if (fragment === 'error') {
    body = (
      <div role="alert" className="stack">
        <p>{es.fragment.loadError}</p>
        <div>
          <Button onClick={onRetry}>{es.common.retry}</Button>
        </div>
      </div>
    );
  } else if (isImageFragment(fragment)) {
    const isQ = tab === 'q';
    const page = isQ ? fragment.questionPage : fragment.answerPage;
    const printed = isQ ? q.printedPage : q.answerSource.printedPage;
    const img = isQ ? fragment.questionImage : fragment.answerImage;
    body = (
      <ImageViewer
        key={img}
        src={resolveImage(img)}
        alt={`Página ${page} del PDF de Messer: ${isQ ? `contiene la pregunta ${q.originalLabel}` : `clave de respuestas que incluye la ${q.originalLabel}`}`}
        caption={`Página ${page} del PDF (impresa ${printed}). La página contiene varias preguntas: buscá la ${q.originalLabel}.`}
      />
    );
  } else {
    const text = tab === 'q' ? fragment.question : fragment.answer;
    body = (
      <div className="stack">
        <p className="notice info">
          <Info size={18} aria-hidden="true" />
          <span>{es.fragment.textNotice}</span>
        </p>
        <pre lang="en" className={s.pre} tabIndex={0}>
          {text}
        </pre>
        <div className="row">
          <Button icon={<Copy size={16} aria-hidden="true" />} onClick={() => copy(text)}>
            {es.fragment.copy}
          </Button>
          <span aria-live="polite" className="small muted">
            {copied}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={es.fragment.title(q.originalLabel)} size="lg">
      <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as 'q' | 'a')} idPrefix={prefix} label="Página del fragmento" />
      <TabPanel idPrefix={prefix} id={tab}>
        {body}
      </TabPanel>
    </Dialog>
  );
}
