/** Utilidades de prueba del servidor (no las usa el código de producción). */
import type { AnalyzeItem, AnalyzeRequest } from '../shared/analysis/contract.js';
import { serverBank, type ServerBank } from './bank.js';
import type { HandlerRequest } from './handler.js';
import type { LiteQuestion } from './bankTypes.js';

export const TOKEN = 'tok_'.padEnd(32, 'x');
export const KEY_ENV = { ANTHROPIC_API_KEY: 'sk-ant-test-0000000000', AI_ACCESS_TOKEN: TOKEN };

export function wrongLetter(q: LiteQuestion): string {
  return q.options.find((o) => !q.correct.includes(o.letter))!.letter;
}

export function item(id: string, result: 'correct' | 'incorrect' | 'omitted', bank: ServerBank = serverBank()): AnalyzeItem {
  const q = bank.byId.get(id)!;
  const selected = result === 'correct' ? q.correct.slice() : result === 'incorrect' ? [wrongLetter(q)] : [];
  return { id, hash: q.contentHash, selected, result };
}

export function request(items: AnalyzeItem[], extra: Partial<AnalyzeRequest> = {}, bank: ServerBank = serverBank()): AnalyzeRequest {
  return { schemaVersion: 1, bankVersion: bank.bankVersion, attempt: { items, notScoredCount: 0 }, history: { questions: [], chapters: [] }, ...extra };
}

export function post(body: unknown, headers: Record<string, string | undefined> = {}): HandlerRequest {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, host: 'app.test', origin: 'https://app.test', ...headers },
    rawBody: typeof body === 'string' ? body : JSON.stringify(body),
    ip: '203.0.113.7',
  };
}
