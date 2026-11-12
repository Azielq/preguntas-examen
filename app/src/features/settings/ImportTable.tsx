import type { DocId, ImportReport } from '../../bank/types';

export interface ImportRow {
  label: string;
  values: [number, number, number];
}

/** Filas de la tabla de resumen, armadas desde import-report.json (nunca con números fijos). */
export function importRows(r: ImportReport, extended = false): ImportRow[] {
  const g = r.stats.gorgotsias;
  const m = r.stats.messer;
  const row = (label: string, pick: (d: (typeof r.stats)[DocId]) => number): ImportRow => {
    const a = pick(g);
    const b = pick(m);
    return { label, values: [a, b, a + b] };
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

export function ImportTable({ report, extended = false, pbqCount }: { report: ImportReport; extended?: boolean; pbqCount?: Record<DocId, number> }) {
  const rows = importRows(report, extended);
  return (
    <div className="table-wrap">
      <table className="table" data-testid="import-table">
        <caption>Resumen de importación del banco</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Dato</span>
            </th>
            <th scope="col" className="n">
              Gorgotsias
            </th>
            <th scope="col" className="n">
              Messer
            </th>
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
          {extended && pbqCount !== undefined && (
            <tr>
              <th scope="row">Soluciones PBQ (no puntuables)</th>
              <td className="n">{pbqCount.gorgotsias}</td>
              <td className="n">{pbqCount.messer}</td>
              <td className="n">{pbqCount.gorgotsias + pbqCount.messer}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
