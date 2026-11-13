// @vitest-environment node
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import type { ErrorBody } from '../../shared/analysis/contract';
import { validOutput } from '../../shared/analysis/fixtures';
import { API_OUTPUT_SCHEMA } from '../../shared/analysis/modelSchema';
import { serverBank } from '../bank';
import { handleAnalyze } from '../handler';
import { createRateLimiter } from '../rateLimit';
import { item, KEY_ENV, post, request } from '../testHelpers';
import { createAnthropicProvider, FALLBACK_BETA, finalText, mapSdkError, type StreamingClient } from './anthropic';

type Msg = Anthropic.Beta.Messages.BetaMessage;

function message(over: Partial<Msg>): Msg {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text: JSON.stringify(validOutput()), citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 800 },
    ...over,
  } as unknown as Msg;
}

function fakeClient(result: Msg | Error) {
  const bodies: unknown[] = [];
  const client: StreamingClient = {
    beta: {
      messages: {
        stream: vi.fn((body: unknown) => {
          bodies.push(body);
          return { finalMessage: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)) };
        }) as unknown as StreamingClient['beta']['messages']['stream'],
      },
    },
  };
  return { client, bodies };
}

const req = { system: 'SYSTEM', messages: [{ role: 'user' as const, content: 'hola' }] };

describe('proveedor Anthropic (SDK simulado)', () => {
  it('arma el pedido: streaming, salida estructurada, effort, respaldo "default"; sin sampling, tool_choice ni prefill', async () => {
    const { client, bodies } = fakeClient(message({}));
    const p = createAnthropicProvider({ apiKey: 'sk-ant-x', model: 'claude-sonnet-5-5', effort: 'medium', fallbacks: true, client });
    const r = await p.generate(req);
    expect(JSON.parse(r.text)).toEqual(validOutput());
    expect(r.usage).toEqual({ inputTokens: 1200, outputTokens: 800 });
    const b = bodies[0] as Record<string, unknown>;
    expect(b).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 16000,
      system: 'SYSTEM',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: API_OUTPUT_SCHEMA } },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
    });
    for (const k of ['temperature', 'top_p', 'top_k', 'tools', 'tool_choice', 'thinking']) expect(b).not.toHaveProperty(k);
    expect((b.messages as { role: string }[]).at(-1)!.role).toBe('user');
  });

  it('AI_FALLBACKS=off: sin cabecera beta ni fallbacks', async () => {
    const { client, bodies } = fakeClient(message({}));
    await createAnthropicProvider({ apiKey: 'k', model: 'm', effort: 'low', fallbacks: false, client }).generate(req);
    expect(bodies[0]).not.toHaveProperty('betas');
    expect(bodies[0]).not.toHaveProperty('fallbacks');
  });

  it('stop_reason se revisa antes del contenido: refusal → model_refused; max_tokens → invalid_model_output', async () => {
    for (const [stop, code] of [
      ['refusal', 'model_refused'],
      ['max_tokens', 'invalid_model_output'],
      ['pause_turn', 'invalid_model_output'],
    ] as const) {
      const { client } = fakeClient(message({ stop_reason: stop, content: [{ type: 'text', text: '{"summary": "parcial', citations: null }] as Msg['content'] }));
      await expect(createAnthropicProvider({ apiKey: 'k', model: 'm', effort: 'medium', fallbacks: true, client }).generate(req)).rejects.toMatchObject({ code });
    }
  });

  it('con respaldo, usa solo el texto posterior al último bloque fallback', () => {
    const content = [
      { type: 'text', text: '{"parcial":' },
      { type: 'fallback', from: { model: 'claude-sonnet-5-5' }, to: { model: 'claude-sonnet-5' } },
      { type: 'text', text: '{"ok":true}' },
    ] as unknown as Msg['content'];
    expect(finalText(content)).toBe('{"ok":true}');
  });

  it('errores tipados del SDK → códigos de 3.4', () => {
    const h = new Headers();
    const cases: [unknown, string][] = [
      [new Anthropic.RateLimitError(429, { error: { message: 'raw' } }, 'raw provider message', h), 'upstream_error'],
      [new Anthropic.AuthenticationError(401, undefined, 'invalid x-api-key sk-ant-secreta', h), 'unavailable'],
      [new Anthropic.PermissionDeniedError(403, undefined, 'raw', h), 'unavailable'],
      [new Anthropic.BadRequestError(400, undefined, 'raw', h), 'upstream_error'],
      [new Anthropic.InternalServerError(529, undefined, 'overloaded', h), 'upstream_error'],
      [new Anthropic.APIError(504, undefined, 'gateway', h), 'upstream_timeout'],
      [new Anthropic.APIConnectionTimeoutError(), 'upstream_timeout'],
      [new Anthropic.APIConnectionError({ message: 'socket' }), 'upstream_error'],
      [new Anthropic.APIUserAbortError(), 'upstream_timeout'],
      [new Error('otra cosa'), 'upstream_error'],
    ];
    for (const [e, code] of cases) expect(mapSdkError(e).code).toBe(code);
  });

  it('a través del handler: el mensaje crudo del proveedor y la clave nunca llegan al cuerpo', async () => {
    const raw = 'invalid x-api-key sk-ant-secreta-123 for org';
    const { client } = fakeClient(new Anthropic.AuthenticationError(401, { error: { message: raw } }, raw, new Headers()));
    const provider = createAnthropicProvider({ apiKey: KEY_ENV.ANTHROPIC_API_KEY, model: 'claude-sonnet-5-5', effort: 'medium', fallbacks: true, client });
    const r = await handleAnalyze(post(request([item('gor-cap1-0002', 'incorrect')])), { env: KEY_ENV, bank: serverBank, provider, limiter: createRateLimiter(), log: () => {} });
    expect(r.status).toBe(503);
    expect((JSON.parse(r.body) as ErrorBody).error.code).toBe('unavailable');
    expect(r.body).not.toContain('sk-ant');
    expect(r.body).not.toContain('x-api-key');

    const { client: c2 } = fakeClient(message({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber', explanation: 'detalle interno' } } as Partial<Msg>));
    const p2 = createAnthropicProvider({ apiKey: 'k', model: 'claude-sonnet-5-5', effort: 'medium', fallbacks: true, client: c2 });
    const r2 = await handleAnalyze(post(request([item('gor-cap1-0002', 'incorrect')])), { env: KEY_ENV, bank: serverBank, provider: p2, limiter: createRateLimiter(), log: () => {} });
    expect(r2.status).toBe(502);
    expect((JSON.parse(r2.body) as ErrorBody).error).toMatchObject({ code: 'model_refused', retryable: true });
    expect(r2.body).not.toContain('detalle interno');
  });
});
