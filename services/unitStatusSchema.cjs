'use strict';

const pending = new WeakMap();
function hiddenStatusAlter(column) {
  if (!column) throw new Error('Coluna units.status nao encontrada.');
  const type = String(column.Type || '').toLowerCase();
  if (/^(?:var)?char\(\d+\)$/.test(type) && Number(type.match(/\d+/)[0]) >= 6) return null;
  if (!/^enum\('[a-z_]+'(?:,'[a-z_]+')*\)$/.test(type)) throw new Error('Tipo units.status inesperado; migracao interrompida.');
  const values = [...type.matchAll(/'([a-z_]+)'/g)].map(match => match[1]);
  if (values.includes('hidden')) return null;
  if (column.Extra || column.Comment) throw new Error('Atributos units.status inesperados; migracao interrompida.');
  const collation = String(column.Collation || '');
  if (!/^[a-zA-Z0-9_]+$/.test(collation)) throw new Error('Collation units.status invalida.');
  const nullable = column.Null === 'YES';
  const defaultValue = column.Default == null ? (nullable ? ' DEFAULT NULL' : '')
    : values.includes(column.Default) ? ` DEFAULT '${column.Default}'`
      : (() => { throw new Error('Default units.status inesperado.'); })();
  return `ALTER TABLE units MODIFY COLUMN status ${type.slice(0, -1)},'hidden') COLLATE ${collation} ${nullable ? 'NULL' : 'NOT NULL'}${defaultValue}`;
}
async function ensureUnitStatusSchema(pool) {
  if (!pending.has(pool)) {
    const job = (async () => {
      const [columns] = await pool.query("SHOW FULL COLUMNS FROM units LIKE 'status'");
      const sql = hiddenStatusAlter(columns[0]);
      if (sql) await pool.query(sql);
      return { changed: Boolean(sql) };
    })();
    pending.set(pool, job);
    job.catch(() => pending.delete(pool));
  }
  return pending.get(pool);
}
module.exports = { hiddenStatusAlter, ensureUnitStatusSchema };
