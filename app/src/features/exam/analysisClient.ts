/**
 * Cliente HTTP del análisis con IA: el único fetch a /api/* de la app (PLAN-IA 9.5).
 * URL relativa a import.meta.env.BASE_URL. Sin endpoint (vite preview, file://, hosting estático) = no disponible.
 */
import {
  ERROR_MESSAGES,
  isAiStatus,
  isErrorBody,
  rateLimitedMessage,
  validateAnalyzeResponseShape,
  type AiStatus,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type ErrorCode,
} from '../../../shared/analysis/contract';

const apiUrl = (path: string) => `${import.meta.env.BASE_URL}api/${path}`;

export type StatusResult = { kind: 'ok'; status: AiStatus } | { kind: 'no_endpoint' };

export async function fetchAiStatus(signal?: AbortSignal): Promise<StatusResult> {
  try {
    const res = await fetch(apiUrl('ai-status'), { headers: { Accept: 'application/json' }, cache: 'no-store', signal });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return { kind: 'no_endpoint' };
    const body: unknown = await res.json();
    return isAiStatus(body) ? { kind: 'ok', status: body } : { kind: 'no_endpoint' };
  } catch {
    return { kind: 'no_endpoint' };
  }
}

export interface ClientError {
  code: ErrorCode | 'network' | 'invalid_response';
  message: string;
  retryable: boolean;
  retryAfterSec?: number;
}

export type AnalyzeResult = { ok: true; response: AnalyzeResponse } | { ok: false; error: ClientError };

export const NETWORK_ERROR: ClientError = { code: 'network', message: ERROR_MESSAGES.upstream_error, retryable: true };
export const INVALID_RESPONSE: ClientError = { code: 'invalid_response', message: ERROR_MESSAGES.invalid_model_output, retryable: true };

export async function postAnalyze(body: AnalyzeRequest, token: string | null, signal?: AbortSignal): Promise<AnalyzeResult> {
  let res: Response;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(apiUrl('analyze'), { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store', signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return { ok: false, error: NETWORK_ERROR };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (isErrorBody(data)) {
      const e = data.error;
      const retryAfter = e.retryAfterSec ?? (Number(res.headers.get('retry-after')) || undefined);
      return {
        ok: false,
        error: { code: e.code, message: e.code === 'rate_limited' ? rateLimitedMessage(retryAfter) : ERROR_MESSAGES[e.code], retryable: e.retryable, retryAfterSec: retryAfter },
      };
    }
    // 404/HTML: no hay función en esta instalación
    return { ok: false, error: res.status === 404 ? { code: 'unavailable', message: 'El análisis con IA no está disponible en esta instalación.', retryable: false } : NETWORK_ERROR };
  }
  const shape = validateAnalyzeResponseShape(data);
  if (!shape.ok) return { ok: false, error: INVALID_RESPONSE };
  return { ok: true, response: shape.value };
}
