import { useEffect } from 'react';
import { es } from '../i18n/es';

/** Fija document.title ("Práctica · Sec+ Práctica"). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${es.appName}` : es.appName;
  }, [title]);
}
