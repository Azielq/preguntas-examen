import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import s from './AiGenerated.module.css';

/**
 * Contenedor de texto generado por IA (PLAN-IA 9.2): borde discontinuo, fondo de advertencia, icono y rótulo
 * visible (tres señales, nunca solo color). El texto va como texto plano, con lang="es" y saltos conservados.
 */
export function AiGenerated({
  label,
  variant = 'block',
  heading,
  children,
  className,
}: {
  label?: string;
  variant?: 'block' | 'chip' | 'banner';
  /** encabezado opcional (h2/h3/h4) que se muestra junto al icono */
  heading?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  if (variant === 'chip') {
    return (
      <span className={`${s.chip} ${className ?? ''}`} data-origin="ai-label">
        <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <div className={`${variant === 'banner' ? s.banner : s.block} ${className ?? ''}`} data-origin="ai" lang="es">
      {(heading || label) && (
        <div className={s.head}>
          <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" className={s.icon} />
          {heading ?? <span className={s.label}>{label}</span>}
        </div>
      )}
      {children !== undefined && <div className={s.body}>{children}</div>}
    </div>
  );
}

/** Texto plano de la IA (sin Markdown ni HTML). */
export function AiText({ children, className }: { children: string; className?: string }) {
  return <p className={`${s.text} ${className ?? ''}`}>{children}</p>;
}
