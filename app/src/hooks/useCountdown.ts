import { useEffect, useRef } from 'react';

/**
 * Descuenta tiempo por diferencia de performance.now() mientras la pestaña está abierta.
 * Llama a onTick(deltaMs) cada `interval` ms y a onPersist cada `persistEvery` ms y al ocultarse la página.
 */
export function useCountdown(opts: {
  running: boolean;
  onTick(deltaMs: number): void;
  onPersist(): void;
  interval?: number;
  persistEvery?: number;
}) {
  const ref = useRef(opts);
  ref.current = opts;
  useEffect(() => {
    if (!opts.running) return;
    let last = performance.now();
    let sincePersist = 0;
    const step = () => {
      const now = performance.now();
      const d = now - last;
      last = now;
      sincePersist += d;
      ref.current.onTick(d);
      if (sincePersist >= (ref.current.persistEvery ?? 5000)) {
        sincePersist = 0;
        ref.current.onPersist();
      }
    };
    const id = window.setInterval(step, ref.current.interval ?? 250);
    const onHide = () => {
      step();
      ref.current.onPersist();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      step();
      ref.current.onPersist();
    };
  }, [opts.running]);
}
