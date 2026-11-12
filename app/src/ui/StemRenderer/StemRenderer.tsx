import type { StemBlock } from '../../bank/types';
import s from './StemRenderer.module.css';

/** Muestra el enunciado como texto plano (nunca HTML). `code` conserva líneas y espacios. */
export function StemRenderer({ blocks, id }: { blocks: StemBlock[]; id?: string }) {
  return (
    <div className={s.stem} id={id}>
      {blocks.map((b, i) =>
        b.type === 'code' ? (
          <pre key={i} tabIndex={0} role="group" aria-label="Bloque de registro o código" lang="en" className={s.code}>
            <code>{b.text}</code>
          </pre>
        ) : (
          <p key={i} lang="en" className={`${s.text} pdf-text`}>
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}
