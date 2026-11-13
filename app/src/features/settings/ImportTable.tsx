import { docShort } from '../../bank/selectors';
import { DOC_IDS, type DocId, type DocStats, type ImportReport } from '../../bank/types';

export interface ImportRow {
  label: string;
  /** un valor por documento (en el orden de `importDocs`) y el total al final */
  values: number[];
}

/** Documentos presentes en el reporte, en orden del banco. */
export function importDocs(r: ImportReport): DocId[] {
  return DOC_IDS.filter((d) => r.stats[d] !== undefined);
}

/** Filas de la tabla de resumen, armadas desde import-report.json (nunca con números fijos). */
export function importRows(r: ImportReport, extended = false): ImportRow[] {
  const docs = importDocs(r);
  const row = (label: string, pick: (d: DocStats) => number): ImportRow => {
    const vals = docs.map((d) => pick(r.stats[d]));
    return { label, values: [...vals, vals.reduce((a, b) => a + b, 0)] };
  };
  const rows = [
    row('Encontradas en el PDF', (d) => d.found),
    row('Listas para practicar', (d) => d.scorable),
    row('Respuesta del PDF', (d) => d.answerFromPdf),
    row('Propuestas por IA', (d) => d.aiProposedAnswers),
    row('Con contradicciones', (d) => d.pending),
  ];
  if (extended) {
    rows.push(
      row('Explicaciones del PDF', (d) => d.explanationFromPdf),
      row('Explicaciones generadas por IA', (d) => d.explanationAi),
      row('Selección múltiple', (d) => d.multiple),
      row('Con notas de extracción', (d) => d.withNotes),
    );
  }
  return rows;
}

export function ImportTable({ report, extended = false, pbqCount }: { report: ImportReport; extended?: boolean; pbqCount?: Partial<Record<DocId, number>> }) {
  const rows = importRows(report, extended);
  const docs = importDocs(report);
  const pbq = pbqCount ? docs.map((d) => pbqCount[d] ?? 0) : null;
  return (
    // con tres documentos la tabla puede desplazarse en horizontal en móvil: el contenedor es enfocable
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Resumen de importación del banco (tabla desplazable)">
      <table className="table" data-testid="import-table">
        <caption>Resumen de importación del banco</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Dato</span>
            </th>
            {docs.map((d) => (
              <th key={d} scope="col" className="n">
                {docShort(d)}
              </th>
            ))}
            <th scope="col" className="n">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i} className="n">
                  {v}
                </td>
              ))}
            </tr>
          ))}
          {extended && pbq && (
            <tr>
              <th scope="row">Soluciones PBQ (no puntuables)</th>
              {pbq.map((v, i) => (
                <td key={i} className="n">
                  {v}
                </td>
              ))}
              <td className="n">{pbq.reduce((a, b) => a + b, 0)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
