import type { ReactNode } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/** Encabezado de página: un único h1 (tabindex -1 para recibir el foco al navegar) y fija document.title. */
export function PageHeader({ title, docTitle, description, children }: { title: ReactNode; docTitle: string; description?: ReactNode; children?: ReactNode }) {
  useDocumentTitle(docTitle);
  return (
    <header className="page-head">
      <h1 tabIndex={-1}>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </header>
  );
}
