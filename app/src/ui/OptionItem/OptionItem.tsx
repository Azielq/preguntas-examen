import { CircleCheck, CircleX } from 'lucide-react';
import type { Option } from '../../bank/types';
import type { OptionState } from '../../grading/grade';
import { es } from '../../i18n/es';
import s from './OptionItem.module.css';

export interface OptionItemProps {
  option: Option;
  type: 'single' | 'multiple';
  name: string;
  checked: boolean;
  disabled: boolean;
  state: OptionState;
  onChange(checked: boolean): void;
  shortcutHint?: string;
}

export function OptionItem({ option, type, name, checked, disabled, state, onChange, shortcutHint }: OptionItemProps) {
  let mark: { icon?: 'ok' | 'x'; text: string } | null = null;
  if (state === 'correct') mark = { icon: 'ok', text: es.question.yourAnswerCorrect };
  else if (state === 'incorrect') mark = { icon: 'x', text: es.question.yourAnswerIncorrect };
  else if (state === 'missed') mark = { icon: 'ok', text: es.question.correctAnswer };
  else if (state === 'neutral-locked' && checked) mark = { text: es.question.yourAnswer };
  return (
    <label className={`${s.row} ${s[stateClass(state)] ?? ''} ${disabled ? s.locked : ''}`} data-state={state} data-letter={option.letter}>
      <input
        className={s.input}
        type={type === 'multiple' ? 'checkbox' : 'radio'}
        name={name}
        value={option.letter}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={s.chip} aria-hidden="true">
        {option.letter}
      </span>
      <span className="sr-only">{option.letter}. </span>
      <span className={s.body}>
        <span className={`${s.text} pdf-text`} lang="en">
          {option.text}
        </span>
        {mark && (
          <span className={s.mark}>
            {mark.icon === 'ok' && <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" />}
            {mark.icon === 'x' && <CircleX size={18} strokeWidth={1.75} aria-hidden="true" />}
            <span>{mark.text}</span>
          </span>
        )}
      </span>
      {shortcutHint && !disabled && (
        <span className={s.kbd} aria-hidden="true">
          <kbd className="kbd">{shortcutHint}</kbd>
        </span>
      )}
    </label>
  );
}

function stateClass(st: OptionState): string {
  return st === 'neutral-locked' ? 'neutral' : st;
}
