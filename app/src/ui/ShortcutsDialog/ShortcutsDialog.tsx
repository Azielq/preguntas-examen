import { es } from '../../i18n/es';
import { Dialog } from '../Dialog/Dialog';

export function Kbd({ children }: { children: string }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function ShortcutsDialog({ open, onClose, singleKeyEnabled }: { open: boolean; onClose(): void; singleKeyEnabled: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={es.shortcuts.title}>
      {!singleKeyEnabled && <p className="notice warning">Los atajos de una sola tecla están desactivados en Ajustes.</p>}
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">{es.shortcuts.title}</caption>
          <thead>
            <tr>
              <th scope="col">Tecla</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>
            {es.shortcuts.rows.map(([k, a]) => (
              <tr key={k}>
                <td>
                  <Kbd>{k}</Kbd>
                </td>
                <td>{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">{es.shortcuts.singleKeyNote}</p>
    </Dialog>
  );
}
