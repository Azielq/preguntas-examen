import type { Question } from '../src/bank/types.js';

/** Pregunta tal como la guarda bank-lite.js: lo necesario para reconstruir el enunciado y corregir. */
export type LiteQuestion = Pick<
  Question,
  'id' | 'doc' | 'group' | 'section' | 'topic' | 'stem' | 'options' | 'selectionType' | 'correct' | 'answerStatus' | 'scorable' | 'contentHash' | 'duplicates'
> & {
  review: { status: 'ok' | 'pending' };
  explanation: { origin: 'pdf' | 'ai'; language: 'en' | 'es'; text: string; perOption: Record<string, string> };
};

export interface LiteBank {
  bankVersion: string;
  questions: LiteQuestion[];
}
