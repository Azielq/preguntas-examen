import { SlidersHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import type { DocId } from '../../bank/types';
import { es } from '../../i18n/es';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import s from './FilterBar.module.css';

export interface FilterValue {
  doc?: DocId;
  section?: string;
  objective?: string;
  state?: 'all' | 'unanswered' | 'failed' | 'flagged' | 'pending_review';
  onlyFavorites?: boolean;
}

export interface FilterSectionOption {
  section: string;
  doc: DocId;
  label: string;
  group: 'cap' | 'sim' | 'messer' | 'messerfull';
}

export interface FilterObjectiveOption {
  code: string;
  /** título literal del PDF (inglés) */
  title: string;
}

export interface FilterBarProps {
  value: FilterValue;
  onChange(v: FilterValue): void;
  /** cantidad real de preguntas si se aplicara este cambio al filtro actual */
  countFor(patch: Partial<FilterValue>): number;
  total: number;
  available: { docs: { id: DocId; label: string }[]; sections: FilterSectionOption[]; objectives?: FilterObjectiveOption[] };
  showSection?: boolean;
  mobile?: boolean;
  /** encabezado compacto de la pantalla de pregunta: solo el botón "Filtros (n)" que abre la hoja */
  compact?: boolean;
}

/** Único documento que trae objetivo SY0-701. */
export const OBJECTIVE_DOC: DocId = 'messerfull';

const STATES: { v: NonNullable<FilterValue['state']>; label: string }[] = [
  { v: 'all', label: es.filter.allF },
  { v: 'unanswered', label: es.filter.unanswered },
  { v: 'failed', label: es.filter.failed },
  { v: 'flagged', label: es.filter.flagged },
  { v: 'pending_review', label: es.filter.pendingReview },
];

export function activeCount(f: FilterValue, showSection: boolean): number {
  return (f.doc ? 1 : 0) + (showSection && f.section ? 1 : 0) + (f.objective ? 1 : 0) + (f.state && f.state !== 'all' ? 1 : 0) + (f.onlyFavorites ? 1 : 0);
}

function Controls({ value, onChange, countFor, available, showSection, idp }: FilterBarProps & { idp: string }) {
  const sections = available.sections.filter((x) => !value.doc || x.doc === value.doc);
  const groups: { key: FilterSectionOption['group']; label: string }[] = [
    { key: 'cap', label: es.filter.groupCap },
    { key: 'sim', label: es.filter.groupSim },
    { key: 'messer', label: es.filter.groupMesser },
    { key: 'messerfull', label: es.filter.groupMesserFull },
  ];
  const objectives = available.objectives ?? [];
  // el objetivo solo existe en el libro completo de Messer: con otro documento elegido no se ofrece
  const showObjective = objectives.length > 0 && (!value.doc || value.doc === OBJECTIVE_DOC);
  return (
    <div className={s.controls}>
      <div className="field">
        <label htmlFor={`${idp}-doc`}>{es.filter.doc}</label>
        <select
          id={`${idp}-doc`}
          className="select"
          value={value.doc ?? ''}
          onChange={(e) => {
            const doc = (e.target.value || undefined) as DocId | undefined;
            const keepSection = value.section && available.sections.find((x) => x.section === value.section)?.doc === doc;
            const keepObjective = !doc || doc === OBJECTIVE_DOC;
            onChange({ ...value, doc, section: keepSection ? value.section : undefined, objective: keepObjective ? value.objective : undefined });
          }}
        >
          <option value="">
            {es.filter.all} ({countFor({ doc: undefined, section: undefined })})
          </option>
          {available.docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} ({countFor({ doc: d.id, section: undefined })})
            </option>
          ))}
        </select>
      </div>
      {showSection && (
        <div className="field">
          <label htmlFor={`${idp}-sec`}>{es.filter.section}</label>
          <select
            id={`${idp}-sec`}
            className="select"
            value={value.section ?? ''}
            onChange={(e) => {
              const section = e.target.value || undefined;
              const doc = section ? available.sections.find((x) => x.section === section)?.doc : value.doc;
              const nd = doc ?? value.doc;
              onChange({ ...value, section, doc: nd, objective: !nd || nd === OBJECTIVE_DOC ? value.objective : undefined });
            }}
          >
            <option value="">
              {es.filter.allF} ({countFor({ section: undefined })})
            </option>
            {groups.map((g) => {
              const opts = sections.filter((x) => x.group === g.key);
              if (opts.length === 0) return null;
              return (
                <optgroup key={g.key} label={g.label}>
                  {opts.map((o) => (
                    <option key={o.section} value={o.section}>
                      {o.label} ({countFor({ section: o.section, doc: o.doc })})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      )}
      {showObjective && (
        <div className="field">
          <label htmlFor={`${idp}-obj`}>{es.filter.objective}</label>
          <select
            id={`${idp}-obj`}
            className="select"
            value={value.objective ?? ''}
            aria-describedby={`${idp}-obj-help`}
            onChange={(e) => onChange({ ...value, objective: e.target.value || undefined })}
          >
            <option value="">
              {es.filter.allM} ({countFor({ objective: undefined })})
            </option>
            {objectives.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code} · {o.title} ({countFor({ objective: o.code })})
              </option>
            ))}
          </select>
          <span id={`${idp}-obj-help`} className="small muted">
            {es.filter.objectiveHelp}
          </span>
        </div>
      )}
      <div className="field">
        <label htmlFor={`${idp}-st`}>{es.filter.state}</label>
        <select
          id={`${idp}-st`}
          className="select"
          value={value.state ?? 'all'}
          onChange={(e) => onChange({ ...value, state: e.target.value as FilterValue['state'] })}
        >
          {STATES.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label} ({countFor({ state: o.v })})
            </option>
          ))}
        </select>
      </div>
      <label className={`check ${s.fav}`}>
        <input type="checkbox" checked={!!value.onlyFavorites} onChange={(e) => onChange({ ...value, onlyFavorites: e.target.checked || undefined })} />
        {es.filter.onlyFavorites} ({countFor({ onlyFavorites: true })})
      </label>
    </div>
  );
}

export function FilterBar(props: FilterBarProps) {
  const idp = useId();
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<FilterValue>(props.value);
  const n = activeCount(props.value, !!props.showSection);
  const clear = () => props.onChange({});
  const counter = (
    <div className={s.counter}>
      <span aria-live="polite" className="num">
        {es.filter.count(props.total)}
      </span>
      {n > 0 && (
        <Button variant="ghost" size="sm" onClick={clear}>
          {es.filter.clear}
        </Button>
      )}
    </div>
  );
  if (props.mobile || props.compact) {
    return (
      <div className={props.compact ? s.compact : s.bar}>
        <div className={s.mobileRow}>
          <Button
            size={props.compact ? 'sm' : 'md'}
            data-action="filters"
            icon={<SlidersHorizontal size={18} aria-hidden="true" />}
            onClick={() => {
              setDraft(props.value);
              setSheet(true);
            }}
          >
            {es.filter.mobileButton(n)}
          </Button>
          {!props.compact && counter}
        </div>
        <Dialog
          open={sheet}
          onClose={() => setSheet(false)}
          title="Filtros"
          size="sheet"
          sheet="filters"
          actions={
            <>
              <Button onClick={() => setDraft({})}>{es.filter.clear}</Button>
              <Button
                variant="primary"
                onClick={() => {
                  props.onChange(draft);
                  setSheet(false);
                }}
              >
                {es.filter.apply}
              </Button>
            </>
          }
        >
          <Controls
            {...props}
            idp={`${idp}m`}
            value={draft}
            onChange={setDraft}
            countFor={(patch) => props.countFor({ ...asPatch(draft), ...patch })}
          />
          <p className="small muted num">{es.filter.count(props.countFor(asPatch(draft)))}</p>
        </Dialog>
      </div>
    );
  }
  return (
    <div className={s.bar}>
      <Controls {...props} idp={idp} />
      {counter}
    </div>
  );
}

/** El borrador expresado como parche completo sobre el filtro aplicado. */
function asPatch(draft: FilterValue): Partial<FilterValue> {
  return { doc: draft.doc, section: draft.section, objective: draft.objective, state: draft.state ?? 'all', onlyFavorites: draft.onlyFavorites };
}
