import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Compara el token del pedido con el del servidor en tiempo constante.
 * Se comparan los resúmenes SHA-256 (mismo largo siempre), así el largo del token no se filtra.
 */
export function tokenMatches(given: string | null | undefined, expected: string): boolean {
  if (typeof given !== 'string' || given.length === 0 || expected.length === 0) return false;
  const a = createHash('sha256').update(given, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/** "Authorization: Bearer <token>" → token, o null. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m ? m[1]! : null;
}

/** Identificador no reversible del token para el limitador (nunca se guarda ni se registra el token). */
export function tokenKey(token: string): string {
  return createHash('sha256').update(`secplus-rl:${token}`, 'utf8').digest('hex').slice(0, 32);
}
