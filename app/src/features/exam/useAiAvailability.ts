import { useEffect } from 'react';
import { useAnalysis, type Availability } from '../../state/analysisStore';

export type AiAccess =
  | { kind: 'checking' }
  | { kind: 'no_endpoint' }
  | { kind: 'not_configured' }
  | { kind: 'needs_token' }
  | { kind: 'ready'; provider: 'anthropic' | 'mock'; promptVersion: string };

export function accessFrom(av: Availability, token: string | null): AiAccess {
  if (av.kind === 'checking') return { kind: 'checking' };
  if (av.kind === 'no_endpoint') return { kind: 'no_endpoint' };
  if (!av.status.available) return { kind: 'not_configured' };
  if (av.status.requiresToken && !token) return { kind: 'needs_token' };
  return { kind: 'ready', provider: av.status.provider, promptVersion: av.status.promptVersion };
}

/** Estado real de /api/ai-status (se pide una vez por sesión de página) combinado con el token local. */
export function useAiAccess(): AiAccess {
  const availability = useAnalysis((s) => s.availability);
  const token = useAnalysis((s) => s.token);
  useEffect(() => {
    void useAnalysis.getState().checkStatus();
  }, []);
  return accessFrom(availability, token);
}
