/**
 * Modo de distribución de las pantallas de pregunta (PLAN-LAYOUT 4.1). Única fuente de los umbrales.
 * Los umbrales están en `em` (fuente raíz) para responder también al tamaño de fuente del navegador.
 */
export type LayoutMode = 'fit' | 'fit-wide' | 'flow';

/** Alto mínimo para `fit` (30em = 480 px con fuente de 16 px). */
export const FIT_MIN_HEIGHT_EM = 30;
/** Alto mínimo para `fit-wide` (20em = 320 px). */
export const FIT_WIDE_MIN_HEIGHT_EM = 20;
/** Ancho mínimo para `fit-wide` (40em = 640 px). */
export const FIT_WIDE_MIN_WIDTH_EM = 40;

export interface LayoutInput {
  widthEm: number;
  heightEm: number;
  supportsDvh: boolean;
}

export function resolveLayoutMode({ widthEm, heightEm, supportsDvh }: LayoutInput): LayoutMode {
  if (!supportsDvh) return 'flow';
  if (heightEm >= FIT_MIN_HEIGHT_EM) return 'fit';
  if (heightEm >= FIT_WIDE_MIN_HEIGHT_EM && widthEm >= FIT_WIDE_MIN_WIDTH_EM) return 'fit-wide';
  return 'flow';
}

/** Lee la ventana actual. Sin `CSS.supports` (jsdom) se asume soporte: el modo por defecto en tests es `fit`. */
export function readLayoutInput(win: Window = window): LayoutInput {
  let root = 16;
  try {
    const fs = parseFloat(win.getComputedStyle(win.document.documentElement).fontSize);
    if (Number.isFinite(fs) && fs > 0) root = fs;
  } catch {
    /* sin estilos calculados */
  }
  const css = (win as Window & { CSS?: { supports?(p: string, v: string): boolean } }).CSS;
  const supportsDvh = typeof css?.supports === 'function' ? css.supports('height', '100dvh') : true;
  return { widthEm: win.innerWidth / root, heightEm: win.innerHeight / root, supportsDvh };
}
