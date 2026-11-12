import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { es } from '../../i18n/es';
import { IconButton } from '../Button/Button';
import s from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  size?: 'md' | 'lg' | 'sheet' | 'side';
  /** Elemento que recibe el foco al abrir (por defecto el primero enfocable del cuerpo). */
  initialFocus?: () => HTMLElement | null;
  className?: string;
  role?: 'dialog' | 'alertdialog';
}

/** Envoltorio de <dialog> nativo con showModal(): trampa de foco y Esc nativos; devuelve el foco al cerrar. */
export function Dialog({ open, onClose, title, children, actions, size = 'md', initialFocus, className, role }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      document.documentElement.style.overflow = 'hidden';
      const target = initialFocus?.();
      if (target) target.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, initialFocus]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handleClose = () => {
      document.documentElement.style.overflow = '';
      const el = opener.current as HTMLElement | null;
      if (el && typeof el.focus === 'function' && el.isConnected) el.focus();
      onCloseRef.current();
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      d.close();
    };
    d.addEventListener('close', handleClose);
    d.addEventListener('cancel', onCancel);
    return () => {
      d.removeEventListener('close', handleClose);
      d.removeEventListener('cancel', onCancel);
    };
  }, []);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = '';
    },
    [],
  );

  const sizeCls = size === 'lg' ? s.lg : size === 'sheet' ? s.sheet : size === 'side' ? s.side : '';
  return (
    <dialog
      ref={ref}
      className={[s.dialog, sizeCls, className ?? ''].join(' ')}
      aria-labelledby={titleId}
      role={role}
      onClick={(e) => {
        // clic en el fondo (fuera del contenido) cierra
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {open && (
        <>
          <div className={s.head}>
            <h2 id={titleId} className={s.title}>
              {title}
            </h2>
            <IconButton label={es.common.close} onClick={() => ref.current?.close()}>
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </div>
          <div className={s.body}>{children}</div>
          {actions && <div className={s.actions}>{actions}</div>}
        </>
      )}
    </dialog>
  );
}

/** Cierra programáticamente el <dialog> que contiene al elemento. */
export function closeDialogOf(el: HTMLElement | null) {
  el?.closest('dialog')?.close();
}
