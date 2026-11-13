import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Los tests del servidor y de shared/ corren con `// @vitest-environment node` (sin window).
const hasDom = typeof window !== 'undefined';

// jsdom no implementa <dialog>.showModal/close: polyfill mínimo para tests.
if (hasDom && typeof HTMLDialogElement !== 'undefined') {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __poly?: boolean };
  if (typeof proto.showModal !== 'function') {
    Object.defineProperty(proto, 'open', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('open');
      },
    });
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    proto.show = proto.showModal;
    proto.close = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}

if (hasDom && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (hasDom && (!window.scrollTo || String(window.scrollTo).includes('not implemented'))) {
  window.scrollTo = () => {};
}

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  window.localStorage.clear();
});
