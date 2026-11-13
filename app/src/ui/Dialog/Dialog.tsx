import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { es } from '../../i18n/es';
import { IconButton } from '../Button/Button';
import s from './Dialog.module.css';

export type DialogSize = 'md' | 'lg' | 'sheet' | 'side' | 'reading' | 'full';

export interface DialogProps {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  /** subcabecera fija (pestañas, recapitulación) entre la cabecera y el cuerpo */
  subheader?: ReactNode;
  size?: DialogSize;
  /** Elemento que recibe el foco al abrir (por defecto el primero enfocable del cuerpo, o el título en hojas de lectura). */
  initialFocus?: () => HTMLElement | null;
  /** hojas de lectura: el foco va al título y el cuerpo empieza arriba */
  focusTitle?: boolean;
  className?: string;
  role?: 'dialog' | 'alertdialog';
  /** contrato para tests (PLAN-LAYOUT 14.2): explanation, detail, analysis, fragment, navigator, … */
  sheet?: string;
  titleLang?: string;
}

// Contador de diálogos abiertos: el fondo se desbloquea solo al cerrar el último (PLAN-LAYOUT 9.1).
let openCount = 0;
function lock() {
  openCount += 1;
  document.documentElement.style.overflow = 'hidden';
}
function unlock() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.documentElement.style.overflow = '';
}
/** Solo para tests. */
export function __openDialogCount() {
  return openCount;
}

function focusBack(el: Element | null) {
  const h = el as HTMLElement | null;
  if (h && typeof h.focus === 'function' && h.isConnected) {
    h.focus();
    return;
  }
  // el control de origen ya no existe (p. ej., se cambió de pregunta): respaldo de la pantalla
  const fb = document.querySelector<HTMLElement>('[data-focus-fallback]');
  if (fb) {
    if (!fb.hasAttribute('tabindex')) fb.setAttribute('tabindex', '-1');
    fb.focus();
  }
}

/** Envoltorio de <dialog> nativo con showModal(): trampa de foco y Esc nativos; devuelve el foco al cerrar. */
export function Dialog({ open, onClose, title, children, actions, subheader, size = 'md', initialFocus, focusTitle, className, role, sheet, titleLang }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const locked = useRef(false);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      if (!locked.current) {
        locked.current = true;
        lock();
      }
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      const target = initialFocus?.() ?? (focusTitle ? titleRef.current : null);
      if (target) target.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, initialFocus, focusTitle]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const handleClose = () => {
      if (locked.current) {
        locked.current = false;
        unlock();
      }
      focusBack(opener.current);
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
      if (locked.current) {
        locked.current = false;
        unlock();
      }
    },
    [],
  );

  const sizeCls = size === 'md' ? '' : s[size];
  return (
    <dialog
      ref={ref}
      className={[s.dialog, sizeCls, className ?? ''].join(' ')}
      aria-labelledby={titleId}
      role={role}
      data-sheet={sheet}
      data-size={size}
      onClick={(e) => {
        // clic en el fondo (fuera del contenido) cierra
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      {open && (
        <>
          <div className={s.head} data-dialog-head="">
            <h2 id={titleId} ref={titleRef} className={s.title} tabIndex={-1} lang={titleLang}>
              {title}
            </h2>
            <IconButton label={es.common.close} onClick={() => ref.current?.close()} data-action="close">
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </div>
          {subheader && <div className={s.sub}>{subheader}</div>}
          <div className={s.body} ref={bodyRef} data-dialog-body="">
            {children}
          </div>
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
