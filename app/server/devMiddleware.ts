/**
 * Plugin de Vite: atiende /api/analyze y /api/ai-status en `npm run dev` con el mismo núcleo que la función
 * de Vercel (PLAN-IA 2.2). Solo existe en el servidor de desarrollo; `vite preview` no lo monta.
 * Variables: process.env + .env / .env.local (sin prefijo VITE_, nunca llegan al cliente).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin, type ViteDevServer } from 'vite';

type HandlerModule = typeof import('./handler.js');
type BankModule = typeof import('./bank.js');

const LIMIT = 65_536;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      // se corta apenas supera el tope: el núcleo responde 413 sin parsear
      if (size <= LIMIT + 1) chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function headersOf(req: IncomingMessage): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  return out;
}

export function aiDevApi(): Plugin {
  let env: Record<string, string | undefined> = {};
  return {
    name: 'secplus-ai-dev-api',
    apply: 'serve',
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ''), ...process.env };
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const path = (req.url ?? '').split('?')[0];
        if (path !== '/api/analyze' && path !== '/api/ai-status') return next();
        try {
          const handler = (await server.ssrLoadModule('/server/handler.ts')) as HandlerModule;
          const bankMod = (await server.ssrLoadModule('/server/bank.ts')) as BankModule;
          const rawBody = req.method === 'POST' ? await readBody(req) : '';
          const hreq = { method: req.method ?? 'GET', headers: headersOf(req), rawBody, ip: req.socket.remoteAddress ?? 'local' };
          const deps = { env, isDev: true, bank: bankMod.serverBank };
          const out = path === '/api/ai-status' ? handler.handleStatus(hreq, deps) : await handler.handleAnalyze(hreq, deps);
          res.statusCode = out.status;
          for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
          res.end(out.body);
        } catch (e) {
          server.config.logger.error(`[ai-dev-api] ${e instanceof Error ? e.message : String(e)}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: { code: 'upstream_error', message: 'Error interno del servidor de desarrollo.', retryable: true } }));
        }
      });
    },
  };
}
