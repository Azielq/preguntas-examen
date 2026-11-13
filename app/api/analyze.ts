/**
 * Función de Vercel: POST /api/analyze → núcleo de server/handler (PLAN-IA 2.2).
 * Usa la firma Web estándar (Request → Response) del runtime de Node.js de Vercel.
 */
import { serverBank } from '../server/bank.js';
import { handleAnalyze } from '../server/handler.js';
import { MAX_BODY_BYTES } from '../shared/analysis/limits.js';
import { toHandlerRequest, toResponse } from '../server/webAdapter.js';

async function handle(request: Request): Promise<Response> {
  const req = await toHandlerRequest(request, MAX_BODY_BYTES);
  return toResponse(await handleAnalyze(req, { env: process.env, bank: serverBank }));
}

export const POST = handle;
export const GET = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
