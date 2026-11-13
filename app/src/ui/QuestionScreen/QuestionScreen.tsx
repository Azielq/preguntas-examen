import { ChevronsDown, Maximize2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLayoutMode } from '../../hooks/useLayoutMode';
import { MQ, useMediaQuery } from '../../hooks/useMediaQuery';
import { es } from '../../i18n/es';
import { Button } from '../Button/Button';
import { decideFit, type FitState } from './fit';
import type { LayoutMode } from './layoutMode';
import s from './QuestionScreen.module.css';

export interface FitContextValue {
  mode: LayoutMode;
  fit: FitState;
  /** alto del visor del enunciado en stem-scroll */
  stemMax: number | null;
  stemAtEnd: boolean;
  full: boolean;
}

const FitContext = createContext<FitContextValue>({ mode: 'fit', fit: 'complete', stemMax: null, stemAtEnd: true, full: false });

/** Estado de ajuste para el cuerpo de la pregunta (visor acotado del enunciado). */
export function useQuestionFit(): FitContextValue {
  return useContext(FitContext);
}

export interface ActionBarSlots {
  left: ReactNode;
  center?: ReactNode;
  right: ReactNode;
  /** rótulo central largo (> 12 caracteres, p. ej. "Ver lo que dice el PDF"): con < 480 px va en su propia fila */
  centerLong?: boolean;
}

export interface QuestionScreenProps {
  kind: 'practice' | 'exam' | 'review' | 'pbq';
  /** cambia con la pregunta: reinicia el desplazamiento del área y del visor */
  questionKey: string;
  /** fila A del encabezado (navegación de la pantalla) */
  headerTop: ReactNode;
  /** fila B del encabezado (rótulo y conmutadores de la pregunta) */
  headerQuestion?: ReactNode;
  /** cuerpo del área: avisos, enunciado y opciones */
  children: ReactNode;
  /** franja de estado */
  status?: ReactNode;
  actions: ActionBarSlots;
  /** columna derecha (≥ 1280 px, modo fit) */
  aside?: ReactNode;
  asideLabel?: string;
  /** vista completa (PLAN-LAYOUT 6.5); sin `onToggleFull` no se ofrece */
  full?: boolean;
  onToggleFull?(): void;
  /** atributos del <article> que envuelve encabezado, área y franja */
  articleProps?: { 'data-question-id'?: string; 'aria-labelledby'?: string; 'aria-label'?: string };
  /** solo tests: fuerza el estado de ajuste */
  forceFit?: FitState;
  /** área sin medición de enunciado (PBQ): el contenido llena el área */
  fillArea?: boolean;
}

function lineHeightOf(el: Element | null): number {
  if (!el) return 0;
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (Number.isFinite(lh) && lh > 0) return lh;
  const fs = parseFloat(cs.fontSize);
  return Number.isFinite(fs) ? fs * 1.5 : 0;
}

const atEndOf = (el: HTMLElement) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['radio', 'checkbox', 'button', 'submit'].includes(el.type);
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * Marco de las pantallas de pregunta (PLAN-LAYOUT 4–8): encabezado compacto / área (única región con scroll) /
 * fila "continúa" / franja de estado / barra de acciones, con modos fit, fit-wide y flow.
 */
export function QuestionScreen(p: QuestionScreenProps) {
  const mode = useLayoutMode(true);
  const wide = useMediaQuery(MQ.wide);
  const tiny = useMediaQuery(MQ.tiny);
  const full = !!p.full && mode !== 'flow';
  const boxRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ fit: FitState; stemMax: number | null }>({ fit: 'complete', stemMax: null });
  const [stemAtEnd, setStemAtEnd] = useState(false);
  const [areaAtEnd, setAreaAtEnd] = useState(false);
  const [announce, setAnnounce] = useState('');
  const fitMode = mode === 'fit' || mode === 'fit-wide';

  let fit: FitState = p.forceFit ?? measured.fit;
  if (!p.forceFit && (!fitMode || p.fillArea)) fit = 'complete';
  if (full && fit === 'stem-scroll') fit = 'area-scroll';
  if (full && !p.forceFit) fit = 'area-scroll';
  const stemMax = fit === 'stem-scroll' ? (p.forceFit ? measured.stemMax ?? 5 * 26 : measured.stemMax) : null;

  // ---- medición (como máximo un recálculo por cuadro) ----
  const frame = useRef(0);
  const measure = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const box = boxRef.current;
      const area = areaRef.current;
      const inner = innerRef.current;
      if (!box || !area || !inner) return;
      const vp = inner.querySelector<HTMLElement>('[data-stem-viewport]');
      const cs = getComputedStyle(area);
      const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const hBox = box.clientHeight;
      let next: { fit: FitState; stemMax: number | null };
      if (!vp || hBox <= 0) next = { fit: 'complete', stemMax: null };
      else if (mode === 'fit-wide') {
        // dos columnas: no hay visor acotado, solo completo o área desplazable
        next = { fit: inner.offsetHeight + pad <= hBox ? 'complete' : 'area-scroll', stemMax: null };
      } else {
        const hStem = vp.scrollHeight;
        const hRest = inner.offsetHeight - vp.offsetHeight + pad;
        const d = decideFit({ hBox, hStem, hRest, lineHeight: lineHeightOf(vp.querySelector('p, pre') ?? vp) });
        next = { fit: d.state, stemMax: d.stemMax };
      }
      setMeasured((cur) => (cur.fit === next.fit && cur.stemMax === next.stemMax ? cur : next));
    });
  }, [mode]);

  useEffect(() => {
    if (!fitMode || p.fillArea || p.forceFit || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    const box = boxRef.current;
    const inner = innerRef.current;
    if (box) ro.observe(box);
    if (inner) ro.observe(inner);
    const vp = inner?.querySelector('[data-stem-viewport]');
    if (vp) ro.observe(vp);
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [fitMode, measure, p.questionKey, p.fillArea, p.forceFit, full]);

  // ---- al cambiar de pregunta: arriba del todo ----
  useLayoutEffect(() => {
    if (areaRef.current) areaRef.current.scrollTop = 0;
    const vp = innerRef.current?.querySelector<HTMLElement>('[data-stem-viewport]');
    if (vp) vp.scrollTop = 0;
    setStemAtEnd(false);
    setAreaAtEnd(false);
  }, [p.questionKey]);

  // ---- indicadores de fin (texto de la fila "continúa" y degradado) ----
  useEffect(() => {
    const vp = innerRef.current?.querySelector<HTMLElement>('[data-stem-viewport]');
    const area = areaRef.current;
    const onStem = () => vp && setStemAtEnd(atEndOf(vp));
    const onArea = () => area && setAreaAtEnd(atEndOf(area));
    vp?.addEventListener('scroll', onStem, { passive: true });
    area?.addEventListener('scroll', onArea, { passive: true });
    onStem();
    onArea();
    return () => {
      vp?.removeEventListener('scroll', onStem);
      area?.removeEventListener('scroll', onArea);
    };
  }, [fit, stemMax, p.questionKey]);

  // ---- alto real de franja + barra para anclar los toasts por encima ----
  useEffect(() => {
    const el = document.documentElement;
    const upd = () => {
      const h = (stackRef.current?.offsetHeight ?? 0) + (barRef.current?.offsetHeight ?? 0);
      el.style.setProperty('--q-bottom-stack', `${h}px`);
    };
    upd();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(upd) : null;
    if (stackRef.current) ro?.observe(stackRef.current);
    if (barRef.current) ro?.observe(barRef.current);
    return () => {
      ro?.disconnect();
      el.style.removeProperty('--q-bottom-stack');
    };
  }, [mode]);

  // ---- vista completa: anuncio y retorno del foco ----
  const opener = useRef<Element | null>(null);
  const prevFull = useRef(full);
  useEffect(() => {
    if (prevFull.current === full) return;
    prevFull.current = full;
    setAnnounce(full ? es.layout.fullOn : es.layout.fullOff);
    if (!full) {
      const el = opener.current as HTMLElement | null;
      requestAnimationFrame(() => {
        if (el && el.isConnected && typeof el.focus === 'function') el.focus();
        else document.querySelector<HTMLElement>('[data-focus-fallback]')?.focus();
      });
    }
  }, [full]);
  const toggleFull = () => {
    if (!full) opener.current = document.activeElement;
    p.onToggleFull?.();
  };

  // ---- teclado: RePág/AvPág/Inicio/Fin desplazan el área; Esc sale de la vista completa ----
  const pRef = useRef(p);
  pRef.current = p;
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
      if (document.querySelector('dialog[open]')) return;
      const t = e.target as HTMLElement | null;
      if (isTextField(t)) return;
      if (e.key === 'Escape' && pRef.current.full) {
        e.preventDefault();
        pRef.current.onToggleFull?.();
        return;
      }
      if (!fitMode) return;
      if (!['PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return;
      if (t?.closest('[role="tablist"], [data-zoom-viewer], pre')) return;
      const vp = innerRef.current?.querySelector<HTMLElement>('[data-stem-viewport]');
      const target = fitRef.current === 'stem-scroll' && vp ? vp : areaRef.current;
      if (!target || target.scrollHeight <= target.clientHeight) return;
      e.preventDefault();
      const page = target.clientHeight * 0.85;
      if (e.key === 'PageDown') target.scrollTop += page;
      else if (e.key === 'PageUp') target.scrollTop -= page;
      else if (e.key === 'Home') target.scrollTop = 0;
      else target.scrollTop = target.scrollHeight;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitMode]);

  const canFull = !!p.onToggleFull && mode !== 'flow';
  const showMore = canFull && !full && fit !== 'complete' && mode === 'fit';
  const headerFullBtn = canFull && !full && fit !== 'complete' && mode === 'fit-wide';
  const asideShown = !!p.aside && wide && mode === 'fit' && !full;
  const fullLabel = tiny || mode === 'fit-wide' ? es.layout.fullShort : es.layout.full;
  const fullBtn = (
    <Button
      size="sm"
      wrap
      onClick={toggleFull}
      aria-pressed={false}
      aria-label={fullLabel === es.layout.full ? undefined : `${fullLabel}: ${es.layout.full}`}
      data-action="full"
      icon={<Maximize2 size={16} aria-hidden="true" />}
    >
      {fullLabel}
    </Button>
  );
  const moreText =
    fit === 'stem-scroll' ? (stemAtEnd ? es.layout.stemRead : es.layout.stemContinues) : areaAtEnd ? es.layout.endOfQuestion : es.layout.questionContinues;
  const bar = (
    <div
      ref={barRef}
      className={`${s.bar} ${p.actions.centerLong ? s.barLong : ''} ${p.actions.center ? '' : s.barTwo}`}
      data-qregion="actions"
      role="group"
      aria-label={es.layout.actions}
    >
      <div className={s.barLeft}>{p.actions.left}</div>
      {mode === 'fit-wide' && p.status && (
        <div className={s.barStatus}>
          {p.status}
        </div>
      )}
      {p.actions.center && <div className={s.barCenter}>{p.actions.center}</div>}
      <div className={s.barRight}>{p.actions.right}</div>
    </div>
  );

  return (
    <FitContext.Provider value={{ mode, fit, stemMax, stemAtEnd, full }}>
      <div className={`${s.screen} ${asideShown ? s.withAside : ''}`} data-qscreen={p.kind} data-view={full ? 'full' : 'normal'}>
        <article className={s.article} {...p.articleProps}>
          <header className={s.header} data-qregion="header">
            {full && (
              <Button size="sm" wrap onClick={toggleFull} aria-pressed={true} data-action="full" icon={<X size={16} aria-hidden="true" />} className={s.exitFull}>
                {tiny ? es.layout.exitShort : es.layout.exit}
              </Button>
            )}
            <div className={s.headRow}>{p.headerTop}</div>
            {p.headerQuestion && <div className={s.headRow}>{p.headerQuestion}</div>}
            {headerFullBtn && (
              <div className={s.headMore}>
                <span className="small muted" aria-hidden="true">
                  {areaAtEnd ? es.layout.endOfQuestion : es.layout.continuesShort}
                </span>
                {fullBtn}
              </div>
            )}
          </header>
          <div className={`${s.box} ${p.fillArea ? s.boxFill : ''}`} ref={boxRef}>
            <div
              ref={areaRef}
              className={`${s.area} ${p.fillArea ? s.areaFill : ''}`}
              data-qregion="area"
              data-fit={fit}
              data-at-end={areaAtEnd ? 'true' : 'false'}
            >
              <div ref={innerRef} className={`${s.inner} ${p.fillArea ? s.innerFill : ''}`}>
                {p.children}
              </div>
            </div>
            {showMore && (
              <div className={s.more} data-qregion="more">
                <span className={s.moreText} aria-hidden="true">
                  <ChevronsDown size={18} aria-hidden="true" />
                  {moreText}
                </span>
                {fullBtn}
              </div>
            )}
          </div>
          {mode !== 'fit-wide' && p.status && (
            <div className={s.status} data-qregion="status" ref={stackRef}>
              {p.status}
            </div>
          )}
        </article>
        {bar}
        {asideShown && (
          <aside className={s.aside} data-qregion="aside" aria-label={p.asideLabel}>
            {p.aside}
          </aside>
        )}
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      </div>
    </FitContext.Provider>
  );
}
