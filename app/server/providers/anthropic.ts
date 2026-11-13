/**
 * Proveedor real (PLAN-IA 2.6). Única importación de @anthropic-ai/sdk del proyecto.
 * - Un pedido a Messages, sin herramientas, con streaming interno y finalMessage() (evita timeouts HTTP).
 * - Salida estructurada con output_config.format (json_schema); profundidad con output_config.effort.
 * - Sin temperature/top_p/top_k/budget_tokens ni prefill; sin tool_choice forzado.
 * - Respaldo ante rechazo del lado del servidor: beta "server-side-fallback-2026-07-01" + fallbacks: "default".
 * - stop_reason se revisa antes de leer el contenido.
 * Firmas confirmadas contra @anthropic-ai/sdk 1.8 (resources/beta/messages) y la documentación de la API.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageStreamParams } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { MODEL_MAX_TOKENS } from '../../shared/analysis/limits.js';
import { API_OUTPUT_SCHEMA } from '../../shared/analysis/modelSchema.js';
import { ProviderError, type AnalysisProvider, type ProviderResult } from './types.js';

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
export type Effort = 'low' | 'medium' | 'high';

/** Lo mínimo del cliente del SDK que usa el proveedor (permite inyectar un doble en los tests). */
export interface StreamingClient {
  beta: {
    messages: {
      stream(body: BetaMessageStreamParams, options?: { signal?: AbortSignal }): { finalMessage(): Promise<Anthropic.Beta.Messages.BetaMessage> };
    };
  };
}

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  effort: Effort;
  fallbacks: boolean;
  /** solo tests */
  client?: StreamingClient;
  /** tiempo máximo del pedido al proveedor (ms) */
  timeoutMs?: number;
}

/** Texto final: los bloques "text" posteriores al último bloque "fallback" (un stream conserva lo parcial del modelo que rechazó). */
export function finalText(content: Anthropic.Beta.Messages.BetaContentBlock[]): string {
  let start = 0;
  content.forEach((b, i) => {
    if (b.type === 'fallback') start = i + 1;
  });
  return content
    .slice(start)
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/** Traduce los errores tipados del SDK (de lo más específico a lo más general). Nunca reenvía el mensaje crudo. */
export function mapSdkError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new ProviderError('upstream_timeout', 'abort');
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError('upstream_timeout', 'connection_timeout');
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError('upstream_error', 'connection_error');
  if (e instanceof Anthropic.AuthenticationError) return new ProviderError('unavailable', 'authentication_error');
  if (e instanceof Anthropic.PermissionDeniedError) return new ProviderError('unavailable', 'permission_denied');
  if (e instanceof Anthropic.RateLimitError) return new ProviderError('upstream_error', 'rate_limited_upstream');
  if (e instanceof Anthropic.BadRequestError) return new ProviderError('upstream_error', 'bad_request');
  if (e instanceof Anthropic.InternalServerError) return new ProviderError('upstream_error', `server_error_${e.status}`);
  if (e instanceof Anthropic.APIError) return new ProviderError(e.status === 504 || e.status === 408 ? 'upstream_timeout' : 'upstream_error', `api_error_${e.status ?? 'unknown'}`);
  return new ProviderError('upstream_error', 'unknown');
}

export function createAnthropicProvider(opts: AnthropicProviderOptions): AnalysisProvider {
  const timeoutMs = opts.timeoutMs ?? 270_000;
  const client: StreamingClient = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 1, timeout: timeoutMs });
  return {
    name: 'anthropic',
    model: opts.model,
    async generate(req, { signal } = {}): Promise<ProviderResult> {
      const body: BetaMessageStreamParams = {
        model: opts.model,
        max_tokens: MODEL_MAX_TOKENS,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: { effort: opts.effort, format: { type: 'json_schema', schema: API_OUTPUT_SCHEMA } },
        ...(opts.fallbacks ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
      };
      let msg: Anthropic.Beta.Messages.BetaMessage;
      try {
        msg = await client.beta.messages.stream(body, { signal }).finalMessage();
      } catch (e) {
        throw mapSdkError(e);
      }
      // stop_reason antes que el contenido
      if (msg.stop_reason === 'refusal') throw new ProviderError('model_refused', `refusal:${msg.stop_details?.category ?? 'null'}`);
      if (msg.stop_reason === 'max_tokens') throw new ProviderError('invalid_model_output', 'max_tokens');
      if (msg.stop_reason !== 'end_turn') throw new ProviderError('invalid_model_output', `stop_reason:${msg.stop_reason ?? 'null'}`);
      return {
        text: finalText(msg.content),
        model: msg.model,
        usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
      };
    },
  };
}
