'use strict';

// Types of material, not priced filament spools or stock. No schema migration needed.
const PREFERENCE_KEY = 'print3d.materials.v1';
const DEFAULT_MATERIALS = Object.freeze([
  'PLA', 'PLA+', 'PLA Silk', 'PETG', 'ABS', 'ASA', 'TPU', 'TPE',
  'PA (Nylon)', 'PC', 'PP', 'PVA', 'BVOH', 'HIPS', 'Resina',
]);
const nameKey = name => name.normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s*\+\s*/g, '+');
const knownNames = new Map(DEFAULT_MATERIALS.map(name => [nameKey(name), name]));
for (const alias of ['nylon', 'pa', 'poliamida']) knownNames.set(alias, 'PA (Nylon)');

function normalizeMaterialName(value) {
  if (typeof value !== 'string') return '';
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80 || /[<>\u0000-\u001f\u007f]/u.test(value)) return '';
  return knownNames.get(nameKey(name)) || name;
}

function materialCatalog(saved) {
  const values = typeof saved === 'string' ? JSON.parse(saved) : saved;
  if (values != null && !Array.isArray(values)) throw new Error('Cadastro de materiais inválido.');
  const names = new Map();
  for (const value of [...DEFAULT_MATERIALS, ...(values || [])]) {
    const name = normalizeMaterialName(value);
    if (name && !names.has(nameKey(name))) names.set(nameKey(name), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }));
}

function registerPrint3dMaterialRoutes(app, { pool, requireAdminBearerToken }) {
  const admin = async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return requireAdminBearerToken(req, reply);
  };
  app.get('/admin/print3d/materials', { preHandler: admin }, async () => {
    const [rows] = await pool.query('SELECT value_json FROM admin_preferences WHERE preference_key=? LIMIT 1', [PREFERENCE_KEY]);
    return { materials: materialCatalog(rows[0]?.value_json) };
  });
  app.post('/admin/print3d/materials', { preHandler: admin }, async (req, reply) => {
    const name = normalizeMaterialName(req.body?.name);
    if (!name) return reply.code(400).send({ error: 'Informe um material válido com até 80 caracteres.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // Ensure a lockable row exists even for simultaneous first additions.
      await connection.query('INSERT IGNORE INTO admin_preferences (preference_key,value_json) VALUES (?,?)', [PREFERENCE_KEY, JSON.stringify(DEFAULT_MATERIALS)]);
      const [rows] = await connection.query('SELECT value_json FROM admin_preferences WHERE preference_key=? FOR UPDATE', [PREFERENCE_KEY]);
      const materials = materialCatalog(rows[0]?.value_json);
      const existing = materials.find(item => nameKey(item) === nameKey(name));
      if (existing) {
        await connection.commit();
        return { name: existing, created: false, materials };
      }
      if (materials.length >= 500) {
        await connection.rollback();
        return reply.code(400).send({ error: 'O cadastro atingiu o limite de 500 materiais.' });
      }
      const updated = materialCatalog([...materials, name]);
      await connection.query('UPDATE admin_preferences SET value_json=?,updated_at=CURRENT_TIMESTAMP WHERE preference_key=?', [JSON.stringify(updated), PREFERENCE_KEY]);
      await connection.commit();
      return reply.code(201).send({ name, created: true, materials: updated });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  });
}

module.exports = { registerPrint3dMaterialRoutes, normalizeMaterialName, materialCatalog };
