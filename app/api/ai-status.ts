/** Función de Vercel: GET /api/ai-status → núcleo de server/handler (PLAN-IA 2.4). */
import { serverBank } from '../server/bank.js';
import { handleStatus } from '../server/handler.js';
import { toHandlerRequest, toResponse } from '../server/webAdapter.js';

async function handle(request: Request): Promise<Response> {
  const req = await toHandlerRequest(request, 0);
  return toResponse(handleStatus(req, { env: process.env, bank: serverBank }));
}

export const GET = handle;
export const POST = handle;
