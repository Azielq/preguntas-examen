import { Skeleton } from '../States/States';
import s from './StudyPlanSkeleton.module.css';

/** Forma del plan mientras carga (resumen + 3 tarjetas). Estático con prefers-reduced-motion. */
export function StudyPlanSkeleton() {
  return (
    <div className={s.wrap} aria-hidden="true">
      <div className={s.summary}>
        <Skeleton lines={3} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={s.card}>
          <Skeleton lines={2} />
        </div>
      ))}
    </div>
  );
}
