import { Dialog } from '../../ui/Dialog/Dialog';
import { NavigatorLegend, QuestionNavigator, type NavItemData } from '../../ui/QuestionNavigator/QuestionNavigator';

/** Navegador en hoja (PLAN-LAYOUT 10): lateral con ≥ 768 px, pantalla completa con menos; leyenda como pie fijo. */
export function NavigatorSheet({
  open,
  onClose,
  title,
  items,
  onGo,
  mode,
}: {
  open: boolean;
  onClose(): void;
  title: string;
  items: NavItemData[];
  onGo(index: number): void;
  mode: 'practice' | 'exam' | 'review';
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="side"
      sheet="navigator"
      actions={<NavigatorLegend mode={mode} />}
      initialFocus={() => {
        // la pregunta actual queda a la vista y recibe el foco al abrir (PLAN-LAYOUT 10)
        const cur = document.querySelector<HTMLElement>('dialog[data-sheet="navigator"] [aria-current="true"]');
        cur?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
        return cur;
      }}
    >
      {open && (
        <QuestionNavigator
          items={items}
          legend={false}
          onGo={(i) => {
            onClose();
            onGo(i);
          }}
          mode={mode}
        />
      )}
    </Dialog>
  );
}

/** Tras pasar de pregunta desde una hoja o el navegador: el foco va al rótulo de la nueva pregunta. */
export function focusQuestionHeading() {
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-focus-fallback]')?.focus()));
}
