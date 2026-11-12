import { useEffect, useState, type ReactNode } from 'react';
import s from './Progress.module.css';

/** Evita animar al montar: la transición solo se activa después del primer render. */
function useAnimateAfterMount() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

export function ProgressRing({
  value,
  max,
  label,
  size = 120,
  tone = 'accent',
  children,
}: {
  value: number;
  max: number;
  label: string;
  size?: number;
  tone?: 'accent' | 'success';
  children?: ReactNode;
}) {
  const animate = useAnimateAfterMount();
  if (max === 0) return null;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / max));
  return (
    <div
      className={s.ring}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={label}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className={s.track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`${s.value} ${tone === 'success' ? s.success : ''} ${animate ? s.anim : ''}`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={s.center}>{children}</div>
    </div>
  );
}

export interface Segment {
  value: number;
  tone: 'success' | 'danger' | 'accent';
  label: string;
}

export function ProgressBar({
  value,
  max,
  label,
  segments,
  className,
}: {
  value: number;
  max: number;
  label: string;
  segments?: Segment[];
  className?: string;
}) {
  const animate = useAnimateAfterMount();
  if (max === 0) return null;
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  return (
    <div
      className={[s.bar, className ?? ''].join(' ')}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={label}
      aria-label={label}
    >
      {segments ? (
        segments.map((seg, i) => (
          <span key={i} className={`${s.fill} ${s[seg.tone]} ${animate ? s.animW : ''}`} style={{ width: pct(seg.value) }} />
        ))
      ) : (
        <span className={`${s.fill} ${s.accent} ${animate ? s.animW : ''}`} style={{ width: pct(value) }} />
      )}
    </div>
  );
}
