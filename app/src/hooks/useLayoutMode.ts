import { useEffect, useLayoutEffect, useState } from 'react';
import { readLayoutInput, resolveLayoutMode, type LayoutMode } from '../ui/QuestionScreen/layoutMode';
import { MQ, useMediaQuery } from './useMediaQuery';

function current(): LayoutMode {
  if (typeof window === 'undefined') return 'fit';
  return resolveLayoutMode(readLayoutInput(window));
}

/**
 * Modo de distribución de la pantalla de pregunta (PLAN-LAYOUT 4.1). Con `publish`, lo publica en
 * `html[data-qlayout]` mientras el componente esté montado (antes del primer cuadro: efecto de layout).
 */
export function useLayoutMode(publish = false): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(current);
  useEffect(() => {
    const on = () => setMode(current());
    on();
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  useLayoutEffect(() => {
    if (!publish) return;
    const el = document.documentElement;
    el.setAttribute('data-qlayout', mode);
    return () => el.removeAttribute('data-qlayout');
  }, [publish, mode]);
  return mode;
}

export interface QuestionChrome {
  mode: LayoutMode;
  /** ≥ 1280 px */
  wide: boolean;
  /** < 768 px */
  mobile: boolean;
  /** < 480 px */
  narrow: boolean;
  /** columna derecha visible (≥ 1280 px y modo fit) */
  asideShown: boolean;
  /** encabezado compacto: acciones secundarias agrupadas en "Más" (< 480 px o fit-wide) */
  compact: boolean;
}

/** Datos de distribución que las pantallas necesitan para decidir qué controles van en el encabezado. */
export function useQuestionChrome(full = false): QuestionChrome {
  const mode = useLayoutMode(false);
  const wide = useMediaQuery(MQ.wide);
  const mobile = useMediaQuery(MQ.mobile);
  const narrow = useMediaQuery(MQ.narrow);
  return { mode, wide, mobile, narrow, asideShown: wide && mode === 'fit' && !full, compact: narrow || mode === 'fit-wide' };
}
