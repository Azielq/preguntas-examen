import { MapPinOff } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { es } from '../../i18n/es';
import { ButtonLink } from '../../ui/Button/Button';
import { EmptyState } from '../../ui/States/States';

export function NotFound({ title = es.notFound.title, description = es.notFound.description }: { title?: string; description?: string }) {
  useDocumentTitle('No encontrada');
  return (
    <EmptyState
      icon={<MapPinOff aria-hidden="true" />}
      title={title}
      description={description}
      headingLevel={1}
      action={
        <ButtonLink to="/" variant="primary">
          {es.notFound.action}
        </ButtonLink>
      }
    />
  );
}
