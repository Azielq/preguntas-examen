import { Maximize, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { es } from '../../i18n/es';
import { Button, IconButton } from '../Button/Button';
import s from './ImageViewer.module.css';

export const ZOOM_MIN = 25;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 25;

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z)));
}

export function nextZoom(current: number, dir: 1 | -1): number {
  const steps = Math.floor(current / ZOOM_STEP) * ZOOM_STEP;
  const n = dir === 1 ? (steps <= current ? steps + ZOOM_STEP : steps) : steps >= current ? steps - ZOOM_STEP : steps;
  return clampZoom(n);
}

/**
 * Visor con zoom (25 %–200 % del tamaño real de la imagen, en pasos de 25 %), "Ajustar al ancho" por defecto,
 * desplazamiento nativo y por arrastre, Ctrl + rueda, pellizco y teclas + − 0.
 */
export function ImageViewer({
  src,
  alt,
  naturalWidth = 1200,
  naturalHeight = 1800,
  caption,
}: {
  src: string;
  alt: string;
  naturalWidth?: number;
  naturalHeight?: number;
  caption?: string;
}) {
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);
  const [fitLevel, setFitLevel] = useState(100);
  const [announce, setAnnounce] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const nat = useRef({ w: naturalWidth, h: naturalHeight });

  const currentLevel = zoom === 'fit' ? fitLevel : zoom;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setFitLevel(clampZoom((el.clientWidth / nat.current.w) * 100) || 100);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [status]);

  const setLevel = useCallback(
    (z: 'fit' | number) => {
      const el = box.current;
      // mantener el centro visible al cambiar el zoom
      const prev = zoomRef.current === 'fit' ? fitLevel : zoomRef.current;
      const next = z === 'fit' ? fitLevel : z;
      let cx = 0.5;
      let cy = 0;
      if (el && el.scrollWidth > 0) {
        cx = (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth;
        cy = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight;
      }
      setZoom(z);
      setAnnounce(z === 'fit' ? `${es.image.fit}: ${es.image.level(fitLevel)}` : es.image.level(z));
      if (el && prev !== next) {
        requestAnimationFrame(() => {
          el.scrollLeft = cx * el.scrollWidth - el.clientWidth / 2;
          el.scrollTop = cy * el.scrollHeight - el.clientHeight / 2;
        });
      }
    },
    [fitLevel],
  );

  const zoomBy = useCallback((dir: 1 | -1) => setLevel(nextZoom(zoomRef.current === 'fit' ? fitLevel : zoomRef.current, dir)), [fitLevel, setLevel]);

  // Ctrl + rueda (listener no pasivo para poder evitar el zoom de página)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Pellizco
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let startDist = 0;
    let startLevel = 100;
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startLevel = zoomRef.current === 'fit' ? fitLevel : zoomRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const z = clampZoom(startLevel * (dist(e.touches) / startDist));
        setZoom(z);
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2 && startDist > 0) {
        startDist = 0;
        const z = zoomRef.current;
        if (typeof z === 'number') setAnnounce(es.image.level(z));
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [fitLevel]);

  // Arrastre con mouse
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = box.current!;
    drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const el = box.current!;
    el.scrollLeft = drag.current.l - (e.clientX - drag.current.x);
    el.scrollTop = drag.current.t - (e.clientY - drag.current.y);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomBy(1);
    } else if (e.key === '-' || e.key === '−' || e.key === '_') {
      e.preventDefault();
      zoomBy(-1);
    } else if (e.key === '0') {
      e.preventDefault();
      setLevel(100);
    }
  };

  const width = zoom === 'fit' ? '100%' : `${(nat.current.w * zoom) / 100}px`;
  const url = nonce ? `${src}?r=${nonce}` : src;
  return (
    <figure className={s.viewer}>
      <div className={s.toolbar} role="toolbar" aria-label="Zoom de la imagen">
        <IconButton label={es.image.zoomOut} onClick={() => zoomBy(-1)} disabled={currentLevel <= ZOOM_MIN}>
          <ZoomOut size={20} strokeWidth={1.75} aria-hidden="true" />
        </IconButton>
        <span className={s.level} aria-hidden="true">
          {currentLevel} %
        </span>
        <IconButton label={es.image.zoomIn} onClick={() => zoomBy(1)} disabled={currentLevel >= ZOOM_MAX}>
          <ZoomIn size={20} strokeWidth={1.75} aria-hidden="true" />
        </IconButton>
        <Button size="sm" variant="ghost" icon={<MoveHorizontal size={16} aria-hidden="true" />} onClick={() => setLevel('fit')} aria-pressed={zoom === 'fit'}>
          {es.image.fit}
        </Button>
        <Button size="sm" variant="ghost" icon={<Maximize size={16} aria-hidden="true" />} onClick={() => setLevel(100)}>
          {es.image.reset}
        </Button>
        <span className="sr-only" aria-live="polite">
          {announce}
        </span>
      </div>
      <div
        ref={box}
        className={`${s.box} ${zoom !== 'fit' ? s.zoomed : ''}`}
        tabIndex={0}
        data-zoom-viewer=""
        role="group"
        aria-label={`${alt}. Usá + y − para el zoom, 0 para el tamaño real y las flechas para desplazarte.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {status === 'loading' && <div className={s.skeleton} style={{ aspectRatio: `${naturalWidth} / ${naturalHeight}` }} aria-hidden="true" />}
        {status === 'error' ? (
          <div className={s.error} role="alert">
            <p>{es.image.loadError}</p>
            <Button
              onClick={() => {
                setStatus('loading');
                setNonce((n) => n + 1);
              }}
            >
              {es.common.retry}
            </Button>
          </div>
        ) : (
          <img
            key={url}
            src={url}
            alt={alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            width={naturalWidth}
            height={naturalHeight}
            className={`${s.img} ${status === 'ready' ? '' : s.pending}`}
            style={{ width, maxWidth: zoom === 'fit' ? '100%' : 'none' }}
            onLoad={(e) => {
              const im = e.currentTarget;
              if (im.naturalWidth) nat.current = { w: im.naturalWidth, h: im.naturalHeight };
              setStatus('ready');
            }}
            onError={() => setStatus('error')}
          />
        )}
      </div>
      {caption && <figcaption className={s.caption}>{caption}</figcaption>}
    </figure>
  );
}
