/**
 * Núcleo del servidor (PLAN-IA 2.2): funciones puras sobre { method, headers, rawBody } + dependencias.
 * No conoce Vercel ni Vite; los adaptadores están en api/ y server/devMiddleware.ts.
 */
import { randomUUID } from 'node:crypto';
import {
  ERROR_MESSAGES,
  RETRYABLE,
  rateLimitedMessage,
  validateAnalyzeRequest,
  type AiStatus,
  type AnalyzeResponse,
  type ErrorBody,
  type ErrorCode,
} from '../shared/analysis/contract.js';
import { MAX_BODY_BYTES } from '../shared/analysis/limits.js';
import { bearerToken, tokenKey, tokenMatches } from './auth.js';
import type { ServerBank } from './bank.js';
import { buildModelInput } from './buildModelInput.js';
import { resolveConfig, type AiConfig, type Env } from './config.js';
import { buildRetryMessage, buildUserMessage, errorCodesForRetry, PROMPT_VERSION, SYSTEM_PROMPT, type PromptMessage } from './prompt.js';
import { createAnthropicProvider } from './providers/anthropic.js';
import { createMockProvider, MOCK_SCENARIOS } from './providers/mock.js';
import { ProviderError, type AnalysisProvider } from './providers/types.js';
import { createRateLimiter, type RateLimiter } from './rateLimit.js';
import { verifyOutput } from './verifyOutput.js';

export interface HandlerRequest {
  method: string;
  /** claves en minúscula */
  headers: Record<string, string | undefined>;
  rawBody: string;
  ip?: string;
}

export interface HandlerResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface LogEntry {
  requestId: string;
  code: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  nFailed: number;
}

export interface Deps {
  env: Env;
  /** true solo desde `npm run dev` */
  isDev?: boolean;
  bank: () => ServerBank;
  /** proveedor fijo (tests); si falta se crea según la configuración */
  provider?: AnalysisProvider;
  limiter?: RateLimiter;
  now?: () => number;
  log?: (e: LogEntry) => void;
}

const TEN_MIN = 10 * 60_000;
const DAY = 24 * 60 * 60_000;
const MAX_AUTH_FAILURES = 10;

const defaultLimiter = createRateLimiter();
const providerCache = new Map<string, AnalysisProvider>();

function json(status: number, body: unknown, extra: Record<string, string> = {}): HandlerResponse {
  return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }, body: JSON.stringify(body) };
}

export function errorResponse(status: number, code: ErrorCode, opts: { retryAfterSec?: number; details?: string[]; headers?: Record<string, string> } = {}): HandlerResponse {
  const body: ErrorBody = {
    error: {
      code,
      message: code === 'rate_limited' ? rateLimitedMessage(opts.retryAfterSec) : ERROR_MESSAGES[code],
      retryable: RETRYABLE[code],
      ...(opts.retryAfterSec ? { retryAfterSec: opts.retryAfterSec } : {}),
      ...(opts.details?.length ? { details: opts.details } : {}),
    },
  };
  const headers = { ...(opts.headers ?? {}), ...(opts.retryAfterSec ? { 'Retry-After': String(opts.retryAfterSec) } : {}) };
  return json(status, body, headers);
}

function providerFor(cfg: AiConfig, deps: Deps): AnalysisProvider {
  if (deps.provider) return deps.provider;
  const key = `${cfg.provider}|${cfg.model}|${cfg.effort}|${cfg.fallbacks}|${cfg.apiKey ? tokenKey(cfg.apiKey) : ''}`;
  let p = providerCache.get(key);
  if (!p) {
    p = cfg.provider === 'mock' ? createMockProvider() : createAnthropicProvider({ apiKey: cfg.apiKey!, model: cfg.model, effort: cfg.effort, fallbacks: cfg.fallbacks });
    providerCache.set(key, p);
  }
  return p;
}

function clientIp(req: HandlerRequest): string {
  if (req.ip) return req.ip;
  const xff = req.headers['x-forwarded-for']?.split(',')[0]?.trim();
  return xff || req.headers['x-real-ip']?.trim() || 'unknown';
}

function originAllowed(req: HandlerRequest, cfg: AiConfig): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // sin Origin (mismo origen en GET, herramientas): lo decide el token
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (cfg.allowedOrigins) return cfg.allowedOrigins.some((o) => o === origin.replace(/\/+$/, ''));
  const own = req.headers['x-forwarded-host'] ?? req.headers.host;
  return !!own && own.split(',')[0]!.trim() === host;
}

export function handleStatus(req: HandlerRequest, deps: Deps): HandlerResponse {
  if (req.method !== 'GET' && req.method !== 'HEAD') return errorResponse(405, 'method_not_allowed', { headers: { Allow: 'GET' } });
  const cfg = resolveConfig(deps.env, deps.isDev);
  const status: AiStatus = {
    available: cfg.available,
    reason: cfg.reason,
    requiresToken: cfg.requiresToken,
    provider: cfg.provider,
    promptVersion: PROMPT_VERSION,
    bankVersion: deps.bank().bankVersion,
  };
  return json(200, status);
}

export async function handleAnalyze(req: HandlerRequest, deps: Deps): Promise<HandlerResponse> {
  const now = deps.now ?? Date.now;
  const started = now();
  const requestId = randomUUID();
  const limiter = deps.limiter ?? defaultLimiter;
  const log = deps.log ?? ((e: LogEntry) => console.info(JSON.stringify({ analyze: e })));
  let nFailed = 0;
  const done = (res: HandlerResponse, code: string, usage = { inputTokens: 0, outputTokens: 0 }) => {
    log({ requestId, code, durationMs: now() - started, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, nFailed });
    return res;
  };

  // 1. método y tipo
  if (req.method !== 'POST') return done(errorResponse(405, 'method_not_allowed', { headers: { Allow: 'POST' } }), 'method_not_allowed');
  const ctype = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (ctype !== 'application/json') return done(errorResponse(415, 'unsupported_media_type'), 'unsupported_media_type');

  const cfg = resolveConfig(deps.env, deps.isDev);
  if (!cfg.available) return done(errorResponse(503, 'unavailable'), `unavailable:${cfg.reason}`);

  // 2. origen
  if (!originAllowed(req, cfg)) return done(errorResponse(403, 'forbidden_origin'), 'forbidden_origin');

  // 3. tamaño (sin parsear)
  const declared = Number(req.headers['content-length'] ?? '0');
  if ((Number.isFinite(declared) && declared > MAX_BODY_BYTES) || Buffer.byteLength(req.rawBody, 'utf8') > MAX_BODY_BYTES) return done(errorResponse(413, 'payload_too_large'), 'payload_too_large');

  // 4. token (comparación en tiempo constante; los fallos cuentan por IP)
  const ip = clientIp(req);
  const failKey = `auth-fail:${ip}`;
  let token = 'dev-sin-token';
  if (cfg.requiresToken) {
    if (limiter.count(failKey, TEN_MIN, now()) >= MAX_AUTH_FAILURES) return done(errorResponse(429, 'rate_limited', { retryAfterSec: 600 }), 'rate_limited:auth');
    const given = bearerToken(req.headers.authorization);
    if (!tokenMatches(given, cfg.accessToken!)) {
      limiter.record(failKey, TEN_MIN, now());
      return done(errorResponse(401, 'unauthorized'), 'unauthorized');
    }
    token = given!;
  }

  // 5. esquema estricto
  let raw: unknown;
  try {
    raw = JSON.parse(req.rawBody);
  } catch {
    return done(errorResponse(400, 'invalid_request'), 'invalid_request:json');
  }
  const bank = deps.bank();
  const v = validateAnalyzeRequest(raw, { sections: bank.sections });
  if (!v.ok) return done(errorResponse(400, 'invalid_request', { details: v.errors.slice(0, 10) }), 'invalid_request');

  // 6. coherencia con el banco (y nueva corrección)
  const built = buildModelInput(v.value, bank);
  if (!built.ok) return done(errorResponse(built.status, built.code, { details: built.details }), built.code);
  nFailed = built.built.coverage.failed;

  // 7. límites de uso
  const tk = tokenKey(token);
  const rl = limiter.consume(
    [
      { key: `u10:${tk}:${ip}`, limit: cfg.rate.per10min, windowMs: TEN_MIN },
      { key: `ud:${tk}:${ip}`, limit: cfg.rate.perDay, windowMs: DAY },
      { key: 'global', limit: cfg.rate.globalPerDay, windowMs: DAY },
    ],
    now(),
  );
  if (!rl.ok) return done(errorResponse(429, 'rate_limited', { retryAfterSec: rl.retryAfterSec }), 'rate_limited');

  // Llamada al modelo con un único reintento ante salida inválida
  const provider = providerFor(cfg, deps);
  const scenarioHeader = req.headers['x-mock-scenario'];
  const scenario = provider.name === 'mock' && scenarioHeader && (MOCK_SCENARIOS as readonly string[]).includes(scenarioHeader) ? scenarioHeader : undefined;
  const messages: PromptMessage[] = [{ role: 'user', content: buildUserMessage(built.built.input) }];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let result;
    try {
      result = await provider.generate({ system: SYSTEM_PROMPT, messages }, { scenario });
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError('upstream_error', 'unknown');
      const status = pe.code === 'upstream_timeout' ? 504 : pe.code === 'unavailable' ? 503 : 502;
      return done(errorResponse(status, pe.code), `${pe.code}${pe.internal ? `:${pe.internal}` : ''}`, usage);
    }
    usage.inputTokens += result.usage?.inputTokens ?? 0;
    usage.outputTokens += result.usage?.outputTokens ?? 0;
    const checked = verifyOutput(result.text, built.built);
    if (checked.ok) {
      const body: AnalyzeResponse = {
        schemaVersion: 1,
        promptVersion: PROMPT_VERSION,
        bankVersion: bank.bankVersion,
        provider: provider.name,
        model: result.model || provider.model,
        coverage: built.built.coverage,
        repairs: checked.repairs,
        output: checked.output,
      };
      return done(json(200, body), attempt === 0 ? 'ok' : 'ok_after_retry', usage);
    }
    lastErrors = checked.errors;
    if (attempt === 0) messages.push({ role: 'user', content: buildRetryMessage(errorCodesForRetry(lastErrors)) });
  }
  return done(errorResponse(502, 'invalid_model_output'), `invalid_model_output:${lastErrors.length}`, usage);
}
