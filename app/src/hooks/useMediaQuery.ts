import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

export const MQ = {
  mobile: '(max-width: 767px)',
  narrow: '(max-width: 479px)',
  /** < 400 px: rótulos cortos ("Ver completa", "Explicación (PDF)") con aria-label completo */
  tiny: '(max-width: 399px)',
  /** ≥ 700 px de alto (43,75em): el título de la lista se ve en el encabezado de práctica */
  tall: '(min-height: 43.75em) and (min-width: 768px)',
  tablet: '(min-width: 768px) and (max-width: 1099px)',
  desktop: '(min-width: 1100px)',
  wide: '(min-width: 1280px)',
  finePointer: '(hover: hover) and (pointer: fine)',
};
