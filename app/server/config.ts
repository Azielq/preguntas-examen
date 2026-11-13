/**
 * Resolución de la configuración a partir de variables de entorno (PLAN-IA 2.3 y 2.4).
 * Acceso cerrado por defecto: sin clave o sin token de acceso, el análisis no está disponible.
 */
import type { ProviderName, StatusReason } from '../shared/analysis/contract.js';
import { MIN_ACCESS_TOKEN_LENGTH } from '../shared/analysis/limits.js';
import type { Effort } from './providers/anthropic.js';

export type Env = Record<string, string | undefined>;

export interface AiConfig {
  available: boolean;
  reason: StatusReason;
  provider: ProviderName;
  /** token esperado; null si no se exige (solo desarrollo con mock) */
  accessToken: string | null;
  requiresToken: boolean;
  apiKey: string | null;
  model: string;
  effort: Effort;
  fallbacks: boolean;
  production: boolean;
  allowedOrigins: string[] | null;
  rate: { per10min: number; perDay: number; globalPerDay: number };
}

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : d;
};

/** `isDev`: true solo desde el middleware de `npm run dev`. */
export function resolveConfig(env: Env, isDev = false): AiConfig {
  const production = env.VERCEL_ENV === 'production';
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || null;
  const rawToken = env.AI_ACCESS_TOKEN?.trim() || null;
  const accessToken = rawToken && rawToken.length >= MIN_ACCESS_TOKEN_LENGTH ? rawToken : null;
  const requested = env.AI_PROVIDER?.trim().toLowerCase();
  let provider: ProviderName;
  let disabled = false;
  if (requested === 'off' || requested === 'disabled') {
    provider = 'anthropic';
    disabled = true;
  } else if (requested === 'mock' && !production) provider = 'mock';
  else if (requested === undefined || requested === '') provider = isDev && !apiKey ? 'mock' : 'anthropic';
  else provider = 'anthropic'; // "anthropic", o "mock" ignorado en producción
  // El token se exige siempre salvo con el proveedor simulado en `npm run dev` sin token configurado.
  const requiresToken = !(provider === 'mock' && isDev && !rawToken);
  const effortRaw = env.AI_EFFORT?.trim().toLowerCase();
  const effort: Effort = effortRaw === 'low' || effortRaw === 'high' ? effortRaw : 'medium';
  let reason: StatusReason = 'ok';
  if (disabled) reason = 'disabled';
  else if (provider === 'anthropic' && !apiKey) reason = 'no_key';
  else if (requiresToken && !accessToken) reason = 'no_token';
  const origins = env.AI_ALLOWED_ORIGINS?.split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return {
    available: reason === 'ok',
    reason,
    provider,
    accessToken: requiresToken ? accessToken : null,
    requiresToken,
    apiKey,
    model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
    effort,
    fallbacks: env.AI_FALLBACKS?.trim().toLowerCase() !== 'off',
    production,
    allowedOrigins: origins && origins.length ? origins : null,
    rate: { per10min: int(env.AI_RATE_PER_10MIN, 5), perDay: int(env.AI_RATE_PER_DAY, 30), globalPerDay: int(env.AI_GLOBAL_PER_DAY, 60) },
  };
}
