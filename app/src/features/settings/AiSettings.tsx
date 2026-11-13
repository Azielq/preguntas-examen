import { Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { es } from '../../i18n/es';
import { useAnalysis } from '../../state/analysisStore';
import { toast } from '../../state/toastStore';
import { Button } from '../../ui/Button/Button';
import { useAiAccess } from '../exam/useAiAvailability';
import s from './Settings.module.css';

/** Ajustes → Análisis con IA (PLAN-IA 2.5): token de acceso local (nunca se exporta) y estado real del servicio. */
export function AiSettings() {
  const access = useAiAccess();
  const token = useAnalysis((st) => st.token);
  const availability = useAnalysis((st) => st.availability);
  const setToken = useAnalysis((st) => st.setToken);
  const forgetToken = useAnalysis((st) => st.forgetToken);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);

  let status: string;
  if (access.kind === 'checking') status = es.ai.checking;
  else if (access.kind === 'no_endpoint') status = es.ai.notInstalled;
  else if (access.kind === 'not_configured') status = es.ai.notConfigured;
  else if (access.kind === 'needs_token') status = 'Disponible en este despliegue. Falta cargar tu token de acceso.';
  else if (access.provider === 'mock') status = `Disponible con el proveedor simulado (solo para pruebas): ${es.ai.mockBanner.toLowerCase()}.`;
  else status = 'Disponible.';
  const requiresToken = availability.kind === 'ok' && availability.status.requiresToken;

  return (
    <section id="ia" className={`card ${s.section}`} aria-labelledby="h-ia">
      <h2 id="h-ia">Análisis con IA</h2>
      <p className="muted">
        Estado: <span role="status">{status}</span>
      </p>
      <p className="small muted">
        El análisis envía al proveedor de IA (Anthropic) el contenido de las preguntas del intento, tus respuestas y un resumen de tu historial. Ese contenido proviene de libros con
        derechos de autor. El token de acceso lo da quien administra este despliegue; se guarda solo en este navegador y nunca se exporta.
      </p>
      {availability.kind === 'ok' && !requiresToken && <p className="small">Este entorno no exige token.</p>}
      <form
        className={s.tokenForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          setToken(value);
          setValue('');
          setShow(false);
          toast('Token de acceso guardado');
        }}
      >
        <div className="field">
          <label htmlFor="ai-token">Token de acceso</label>
          <div className={s.tokenRow}>
            <input
              id="ai-token"
              className={`input ${s.tokenInput}`}
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={value}
              placeholder={token ? 'Hay un token guardado' : ''}
              onChange={(e) => setValue(e.target.value)}
              aria-describedby="ai-token-help"
            />
            <Button
              type="button"
              variant="ghost"
              aria-pressed={show}
              icon={show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              onClick={() => setShow(!show)}
            >
              {show ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
          <span id="ai-token-help" className="small muted">
            {token ? 'Ya hay un token guardado en este navegador. Escribí otro para reemplazarlo.' : 'Todavía no cargaste un token.'}
          </span>
        </div>
        <div className="row">
          <Button type="submit" variant="primary" icon={<KeyRound size={18} aria-hidden="true" />} disabled={!value.trim()}>
            Guardar
          </Button>
          <Button
            type="button"
            icon={<Trash2 size={18} aria-hidden="true" />}
            disabled={!token}
            onClick={() => {
              forgetToken();
              toast('Token de acceso olvidado');
            }}
          >
            Olvidar token
          </Button>
        </div>
      </form>
    </section>
  );
}
