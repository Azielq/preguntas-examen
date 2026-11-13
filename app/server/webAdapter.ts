/** Traducción entre Request/Response (Web estándar, Vercel) y el núcleo de handler.ts. */
import type { HandlerRequest, HandlerResponse } from './handler.js';

/** Lee el cuerpo solo si no excede `limit` (+1 byte para que el núcleo detecte el exceso y responda 413). */
export async function toHandlerRequest(request: Request, limit: number): Promise<HandlerRequest> {
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  let rawBody = '';
  if (request.method === 'POST' && limit > 0 && request.body) {
    const declared = Number(headers['content-length'] ?? '0');
    if (Number.isFinite(declared) && declared > limit) rawBody = '';
    else {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        chunks.push(value);
        if (size > limit) {
          await reader.cancel();
          break;
        }
      }
      rawBody = Buffer.concat(chunks).toString('utf8');
    }
  }
  return { method: request.method, headers, rawBody };
}

export function toResponse(r: HandlerResponse): Response {
  return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
}
