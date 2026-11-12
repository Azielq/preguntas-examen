import { CircleHelp, FileCheck2, Sparkles, TriangleAlert } from 'lucide-react';
import { es } from '../../i18n/es';
import s from './AnswerStatusBadge.module.css';

export type BadgeStatus = 'pdf' | 'ai_proposed' | 'pending' | 'unknown';

const ICON = { pdf: FileCheck2, ai_proposed: Sparkles, pending: TriangleAlert, unknown: CircleHelp };

export function AnswerStatusBadge({
  status,
  reasons,
  size = 'md',
  extra,
}: {
  status: BadgeStatus;
  reasons?: string[];
  size?: 'sm' | 'md';
  extra?: string;
}) {
  const Icon = ICON[status];
  const text = es.badge[status];
  const block = (status === 'pending' || status === 'unknown') && reasons && reasons.length > 0;
  if (block || (status === 'pending' && extra)) {
    return (
      <div className={`${s.block} ${s[status]}`} data-badge={status}>
        <p className={s.blockTitle}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{text}</span>
        </p>
        {extra && <p className={s.blockText}>{extra}</p>}
        {reasons && reasons.length > 0 && (
          <div className={s.blockText}>
            <span className={s.reasonLabel}>{es.question.pendingReason}</span>
            <ul className={s.reasons}>
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return (
    <span className={`${s.chip} ${s[status]} ${size === 'sm' ? s.sm : ''}`} data-badge={status}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      {text}
    </span>
  );
}
