import { Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { es, formatDuration } from '../../i18n/es';
import s from './Timer.module.css';

export function Timer({
  remainingMs,
  hidden,
  onToggleHidden,
}: {
  remainingMs: number;
  totalMs: number;
  hidden: boolean;
  onToggleHidden(): void;
}) {
  const [announce, setAnnounce] = useState('');
  const fired = useRef<{ five: boolean; one: boolean }>({ five: remainingMs <= 5 * 60_000, one: remainingMs <= 60_000 });
  useEffect(() => {
    if (!fired.current.five && remainingMs <= 5 * 60_000 && remainingMs > 60_000) {
      fired.current.five = true;
      setAnnounce(es.timer.five);
    }
    if (!fired.current.one && remainingMs <= 60_000 && remainingMs > 0) {
      fired.current.one = true;
      fired.current.five = true;
      setAnnounce(es.timer.one);
    }
  }, [remainingMs]);
  const low = remainingMs < 5 * 60_000;
  return (
    <div className={s.wrap}>
      {hidden ? (
        <button type="button" className={s.toggle} onClick={onToggleHidden}>
          <Eye size={16} aria-hidden="true" /> {es.timer.show}
        </button>
      ) : (
        <>
          <span className={`${s.clock} ${low ? s.low : ''}`}>
            {low && <TriangleAlert size={16} aria-hidden="true" />}
            <span className="sr-only">{es.timer.label}: </span>
            <span role="timer" aria-live="off" className={s.time}>
              {formatDuration(remainingMs)}
            </span>
            {low && <span className={s.lowText}>{es.timer.low}</span>}
          </span>
          <button type="button" className={s.toggle} onClick={onToggleHidden} aria-label={es.timer.hideLong} title={es.timer.hideLong}>
            <EyeOff size={16} aria-hidden="true" /> <span className={s.toggleText}>{es.timer.hide}</span>
          </button>
        </>
      )}
      <span className={hidden && announce ? s.visibleNotice : 'sr-only'} aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
