import { filterToQuery } from '../practice/filterQuery';

export const analysisPlanPath = (attemptId: string) => `/examen/resultado/${attemptId}/plan`;

/** URL de práctica para una lista `plan:` (PLAN-IA 10). Ningún id de pregunta viaja en la query. */
export function planPracticeUrl(firstId: string, attemptId: string, conceptId?: string): string {
  const list = conceptId ? (`plan:${attemptId}:${conceptId}` as const) : (`plan:${attemptId}` as const);
  return `/practica/${firstId}${filterToQuery({ list })}`;
}
