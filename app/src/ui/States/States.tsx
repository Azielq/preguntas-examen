import { TriangleAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { es } from '../../i18n/es';
import { Button } from '../Button/Button';
import s from './States.module.css';

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
}) {
  const H = `h${headingLevel}` as 'h1' | 'h2' | 'h3';
  return (
    <div className={s.empty}>
      {icon && (
        <span className={s.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <H className={s.title} tabIndex={headingLevel === 1 ? -1 : undefined} data-page-title={headingLevel === 1 ? '' : undefined}>
        {title}
      </H>
      {description && <p className={s.desc}>{description}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title, detail, onRetry, retryLabel = es.common.retry }: { title: string; detail?: ReactNode; onRetry?(): void; retryLabel?: string }) {
  return (
    <div className={s.error} role="alert">
      <TriangleAlert size={40} strokeWidth={1.75} aria-hidden="true" className={s.errIcon} />
      <h2 className={s.title}>{title}</h2>
      {detail && (
        <details className={s.details}>
          <summary>{es.bank.technicalDetail}</summary>
          <div className={s.detailBody}>{detail}</div>
        </details>
      )}
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={[s.skel, className ?? ''].join(' ')} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={s.line} style={{ width: `${i === lines - 1 ? 60 : 100 - i * 6}%` }} />
      ))}
    </div>
  );
}

export function LoadingRegion({ children, label = es.common.loading }: { children: ReactNode; label?: string }) {
  return (
    <div aria-busy="true" className={s.loadingRegion}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function QuestionCardSkeleton() {
  return (
    <div className={s.qcard} aria-hidden="true">
      <Skeleton lines={1} className={s.short} />
      <Skeleton lines={3} />
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={s.optionSk} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className={s.dash} aria-hidden="true">
      <span className={s.block} style={{ height: 120 }} />
      <div className={s.dashGrid}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={s.block} style={{ height: 110 }} />
        ))}
      </div>
      <div className={s.dashGrid2}>
        <span className={s.block} style={{ height: 220 }} />
        <span className={s.block} style={{ height: 220 }} />
      </div>
    </div>
  );
}

interface EBState {
  error: Error | null;
}

/** Captura errores de render; nunca borra datos guardados. */
export class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className={s.boundary}>
          <ErrorState
            title="Algo salió mal al mostrar esta pantalla. Tus datos no se borraron."
            detail={<pre className={s.pre}>{this.state.error.message}</pre>}
            onRetry={() => window.location.reload()}
            retryLabel={es.common.reload}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
