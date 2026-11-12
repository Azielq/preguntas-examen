/**
 * Migraciones puras y encadenadas del esquema de almacenamiento.
 * Hoy solo existe la v1; un cambio incompatible agrega `2: migrateV1toV2` y sube CURRENT_SCHEMA.
 */
export const CURRENT_SCHEMA = 1;

type Migration = (x: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {
  // 2: migrateV1toV2,
};

/** Devuelve el objeto en la versión actual, o null si no se puede migrar (versión desconocida o futura). */
export function migrate(raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, current = CURRENT_SCHEMA): unknown {
  if (typeof raw !== 'object' || raw === null) return null;
  let obj = raw as Record<string, unknown>;
  let v = obj.schemaVersion;
  if (typeof v !== 'number' || v < 1 || v > current) return null;
  while (v < current) {
    const m = migrations[v + 1];
    if (!m) return null;
    obj = m(obj);
    v = obj.schemaVersion;
    if (typeof v !== 'number') return null;
  }
  return obj;
}
