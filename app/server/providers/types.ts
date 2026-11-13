import type { ProviderName } from '../../shared/analysis/contract.js';
import type { PromptMessage } from '../prompt.js';

export interface ProviderRequest {
  system: string;
  messages: PromptMessage[];
}

export interface ProviderResult {
  /** texto JSON devuelto por el modelo (sin verificar) */
  text: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface GenerateOptions {
  signal?: AbortSignal;
  /** solo proveedor simulado */
  scenario?: string;
}

export type ProviderErrorCode = 'model_refused' | 'invalid_model_output' | 'upstream_timeout' | 'upstream_error' | 'unavailable';

/** Error tipado del proveedor: el handler lo traduce a la forma de 3.4 sin reenviar el mensaje crudo. */
export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    /** detalle solo para el registro del servidor; nunca llega al cliente */
    public internal = '',
  ) {
    super(code);
    this.name = 'ProviderError';
  }
}

export interface AnalysisProvider {
  name: ProviderName;
  model: string;
  generate(req: ProviderRequest, opts?: GenerateOptions): Promise<ProviderResult>;
}
