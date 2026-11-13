/**
 * Estado de ajuste del área de pregunta (PLAN-LAYOUT 6.2), decidido por medición, nunca por caracteres.
 * Las opciones nunca se acotan: si no entran, se desplaza el área entera.
 */
export type FitState = 'complete' | 'stem-scroll' | 'area-scroll';

/** Mínimo de líneas visibles del enunciado para que valga la pena un visor acotado. */
export const STEM_MIN_LINES = 5;
/** Alto de la fila "continúa" (px). */
export const MORE_ROW = 44;

export interface FitInput {
  /** alto disponible del contenedor que agrupa el área y la fila "continúa" */
  hBox: number;
  /** alto natural del enunciado completo */
  hStem: number;
  /** alto natural de todo lo demás dentro del área (opciones, ayudas, avisos, separaciones, padding) */
  hRest: number;
  /** alto de línea del enunciado (px) */
  lineHeight: number;
}

export interface FitDecision {
  state: FitState;
  /** alto del visor del enunciado en `stem-scroll` (múltiplo entero de `lineHeight`) */
  stemMax: number | null;
}

export function decideFit({ hBox, hStem, hRest, lineHeight }: FitInput): FitDecision {
  // sin medición posible (jsdom, sin ResizeObserver o alturas en 0): todo completo
  if (!(hBox > 0) || !(hStem > 0) || !(lineHeight > 0)) return { state: 'complete', stemMax: null };
  if (hStem + hRest <= hBox) return { state: 'complete', stemMax: null };
  const room = hBox - hRest - MORE_ROW;
  if (room >= STEM_MIN_LINES * lineHeight) {
    const lines = Math.floor(room / lineHeight);
    return { state: 'stem-scroll', stemMax: lines * lineHeight };
  }
  return { state: 'area-scroll', stemMax: null };
}
