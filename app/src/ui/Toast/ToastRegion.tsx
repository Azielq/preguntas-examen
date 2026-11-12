import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { es } from '../../i18n/es';
import s from './Toast.module.css';

export interface ToastView {
  id: number;
  text: string;
  tone: 'info' | 'warning' | 'success';
  persistent: boolean;
  action?: { label: string; href: string };
}

/** Región viva (polite) para confirmaciones breves. Nunca contiene acciones imprescindibles. */
export function ToastRegion({ toasts, onDismiss }: { toasts: ToastView[]; onDismiss(id: number): void }) {
  return (
    <div className={s.region} aria-live="polite" role="status">
      {toasts.map((t) => {
        const Icon = t.tone === 'warning' ? TriangleAlert : t.tone === 'success' ? CircleCheck : Info;
        return (
          <div key={t.id} className={`${s.toast} ${s[t.tone]}`}>
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" className={s.icon} />
            <p className={s.text}>
              {t.text}
              {t.action && (
                <>
                  {' '}
                  <Link to={t.action.href}>{t.action.label}</Link>
                </>
              )}
            </p>
            <button type="button" className={s.close} aria-label={es.common.close} title={es.common.close} onClick={() => onDismiss(t.id)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
