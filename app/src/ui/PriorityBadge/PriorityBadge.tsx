import { ChevronsUp, ChevronUp, Minus } from 'lucide-react';
import s from './PriorityBadge.module.css';

export type Level = 'alta' | 'media' | 'baja';

const TEXT: Record<Level, string> = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' };

/** Texto + icono distinto por nivel: no depende del color (PLAN-IA 9.5). */
export function PriorityBadge({ level }: { level: Level }) {
  const Icon = level === 'alta' ? ChevronsUp : level === 'media' ? ChevronUp : Minus;
  return (
    <span className={`${s.badge} ${s[level]}`} data-priority={level}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {TEXT[level]}
    </span>
  );
}
