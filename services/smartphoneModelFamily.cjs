'use strict';

const { randomUUID, createHash } = require('node:crypto');
const { object, isSmartphoneCategory } = require('./smartphonePriceGroupsCore.cjs');
const conflict = message => Object.assign(new Error(message), { statusCode: 409 });
const scope = (value, defaultId) => !value || value === 'default' ? defaultId : String(value);

// A transacao pertence ao chamador. A trava do modelo serializa duas confirmacoes
// antes da consulta/criacao do pai; nenhum estoque, unidade ou preco e alterado aqui.
async function ensureSmartphoneModelFamily(connection, { modelId, companyId, defaultCompanyId, productId, dryRun = false, expectedRevision } = {}) {
  const company = scope(companyId, defaultCompanyId);
  if (!modelId || !company) throw conflict('Modelo e empresa são obrigatórios para organizar a família.');
  const [[locked]] = await connection.query('SELECT id FROM models WHERE id=? FOR UPDATE', [modelId]);
  if (!locked) throw conflict('Modelo não encontrado.');
  const [[model]] = await connection.query(`SELECT m.id,m.name,m.category_id,m.company_id,m.template_values,
    b.name AS brand_name,c.name AS category_name FROM models m
    LEFT JOIN brands b ON b.id=m.brand_id LEFT JOIN categories c ON c.id=m.category_id WHERE m.id=?`, [modelId]);
  if (!isSmartphoneCategory(model.category_name) || !String(model.name || '').trim()) {
    throw conflict('A criação automática da família exige um modelo de smartphone com nome e categoria.');
  }
  if (model.company_id && scope(model.company_id, defaultCompanyId) !== company) throw conflict('Modelo pertence a outra empresa.');
  const [rows] = await connection.query(`SELECT id,model_id,company_id,parent_id,is_parent,is_print3d,is_combo,offer_type,sku,bling_parent_id
    FROM products WHERE model_id=? ORDER BY id FOR UPDATE`, [modelId]);
  const peers = rows.filter(row => scope(row.company_id, defaultCompanyId) === company);
  const children = peers.filter(row => !Number(row.is_parent) && !Number(row.is_print3d) && !Number(row.is_combo) && !row.offer_type);
  if (!children.length || (productId && !children.some(row => row.id === productId))) throw conflict('Nenhuma variação compatível com este modelo e empresa.');
  const parentIds = [...new Set(children.map(row => row.parent_id).filter(Boolean))];
  const candidates = new Map(peers.filter(row => Number(row.is_parent) === 1).map(row => [row.id, row]));
  const importedParentIds = new Set();
  // Reutilizar tambem pai importado do Bling, mesmo se ainda estiver sem model_id.
  for (const blingId of [...new Set(children.map(row => row.bling_parent_id).filter(Boolean))]) {
    const [imported] = await connection.query(`SELECT id,model_id,company_id,parent_id,is_parent,is_print3d,is_combo,offer_type,sku
      FROM products WHERE bling_id=? AND COALESCE(is_parent,0)=1 FOR UPDATE`, [blingId]);
    for (const row of imported.filter(parent => scope(parent.company_id, defaultCompanyId) === company)) {
      if (row.model_id && row.model_id !== modelId) throw conflict('O pai do Bling pertence a outro modelo. Confira os vínculos.');
      candidates.set(row.id, row);
      importedParentIds.add(row.id);
    }
  }
  for (const id of parentIds) {
    if (candidates.has(id)) continue;
    const [[parent]] = await connection.query(`SELECT id,model_id,company_id,parent_id,is_parent,is_print3d,is_combo,offer_type,sku
      FROM products WHERE id=? FOR UPDATE`, [id]);
    // Pai legado sem empresa só pode ser recuperado a partir dos filhos já vinculados.
    const legacyCompany = parent && !parent.company_id && !defaultCompanyId;
    if (!parent || Number(parent.is_parent) !== 1 || parent.parent_id || Number(parent.is_print3d)
      || Number(parent.is_combo) || parent.offer_type || (!legacyCompany && scope(parent.company_id, defaultCompanyId) !== company)
      || (parent.model_id && parent.model_id !== modelId)) throw conflict('Uma variação está vinculada a outro pai. Confira a família antes de continuar.');
    if (legacyCompany) {
      const [linked] = await connection.query('SELECT id,model_id,company_id FROM products WHERE parent_id=? ORDER BY id FOR UPDATE', [id]);
      if (!linked.length || linked.some(row => row.model_id !== modelId || scope(row.company_id, defaultCompanyId) !== company)) {
        throw conflict('O pai sem empresa possui filhos incompatíveis. Confira a família antes de continuar.');
      }
    }
    candidates.set(id, parent);
  }
  // O pai local já escolhido pelos filhos é a família comercial. Pais do Bling
  // apenas referenciados externamente não concorrem com ele nem são reparentados.
  if (parentIds.length === 1 && candidates.has(parentIds[0])) {
    for (const id of importedParentIds) {
      if (id === parentIds[0]) continue;
      const [linked] = await connection.query('SELECT id,model_id,company_id FROM products WHERE parent_id=? ORDER BY id FOR UPDATE', [id]);
      if (linked.length) throw conflict('Há filhos vinculados a mais de um pai. Confira a família antes de continuar.');
      candidates.delete(id);
    }
  }
  if (candidates.size > 1) throw conflict('Este modelo possui mais de um pai. Confira os vínculos antes de continuar.');
  const existing = [...candidates.values()][0];
  if (existing?.parent_id || Number(existing?.is_print3d) || Number(existing?.is_combo) || existing?.offer_type) throw conflict('O pai existente não é compatível com esta família.');
  const revision = createHash('sha256').update(JSON.stringify({ model: [model.id, model.name, model.category_id, company],
    peers, existing: existing || null })).digest('hex');
  if (expectedRevision && expectedRevision !== revision) throw conflict('A família mudou desde a conferência. Consulte novamente.');
  const parentId = existing?.id || randomUUID();
  const sku = existing?.sku || `MODELO-${createHash('sha256').update(`${company}:${modelId}`).digest('hex').slice(0, 20).toUpperCase()}`;
  if (!existing) {
    const [[occupied]] = await connection.query('SELECT id FROM products WHERE sku=? LIMIT 1 FOR UPDATE', [sku]);
    if (occupied) throw conflict('O SKU reservado para o pai já está em uso. Confira o cadastro.');
  }
  const specs = {};
  for (const key of ['ram', 'ram_fisica', 'physical_ram', 'memoria_ram', 'memoria_ram_fisica', 'memory_ram', 'storage',
    'armazenamento', 'memoria', 'capacity', 'color', 'cor', 'colour', 'color_id', 'imei1', 'imei2', 'imei_1', 'imei_2', 'serial', 'bling_family', 'slug']) delete specs[key];
  const parent = { id: parentId, name: String(model.name).trim(), sku, model_id: modelId, company_id: company,
    category_id: model.category_id, brand: model.brand_name || null, is_parent: 1, parent_id: null,
    price_retail: 0, price_reseller: 0, price_wholesale: 0, price_cost: null, stock_quantity: 0,
    track_inventory: 0, status: 'active', images: [], specs, slug: `familia-${modelId}` };
  const unlinked = children.filter(row => !row.parent_id);
  if (!dryRun) {
    if (!existing) await connection.query(`INSERT INTO products
      (id,name,sku,model_id,company_id,category_id,brand,is_parent,parent_id,price_retail,price_reseller,
       price_wholesale,price_cost,stock_quantity,track_inventory,status,images,specs,slug)
      VALUES (?,?,?,?,?,?,?,1,NULL,0,0,0,NULL,0,0,'active','[]',?,?)`,
    [parentId, parent.name, sku, modelId, company, parent.category_id, parent.brand, JSON.stringify(specs), parent.slug]);
    else if (!existing.model_id) await connection.query('UPDATE products SET model_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [modelId, parentId]);
    if (existing && !existing.company_id && !defaultCompanyId) {
      await connection.query('UPDATE products SET company_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id IS NULL', [company, parentId]);
    }
    for (const child of unlinked) await connection.query("UPDATE products SET parent_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (parent_id IS NULL OR parent_id='')", [parentId, child.id]);
  }
  return { parent_id: parentId, created: !existing, linked_count: unlinked.length, revision, parent,
    children: children.map(row => ({ id: row.id, sku: row.sku, parent_id: parentId })), dry_run: dryRun };
}

module.exports = { ensureSmartphoneModelFamily };
