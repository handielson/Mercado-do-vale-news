'use strict';

const { createHash } = require('node:crypto');

const FIELDS = Object.freeze({
  price_cost: 'Preço de custo',
  description: 'Descrição',
  technical_specifications: 'Especificações técnicas',
  category_id: 'Categoria',
  brand: 'Marca',
  warranty_type: 'Tipo de garantia',
  warranty_template_id: 'Modelo de garantia',
});

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function customFields(product) {
  const value = product?.custom_fields;
  if (typeof value === 'string') return JSON.parse(value || '{}') || {};
  return value || {};
}

function inheritsParentCost(product) { return customFields(product).inherit_parent_cost === true; }

function inheritedCostPatch(parent, child) {
  if (!inheritsParentCost(child)) return {};
  if (!parent || Number(parent.is_parent) !== 1 || String(child.parent_id) !== String(parent.id) || (parent.company_id && child.company_id && String(parent.company_id) !== String(child.company_id))) fail('Pai inválido para herdar custo.', 409);
  if (!Number.isSafeInteger(parent.price_cost) || parent.price_cost < 0) fail('Informe um custo válido no pai antes de aplicar às variações.');
  return { price_cost: parent.price_cost };
}

function buildFamilyInheritancePlan(parent, children, selections) {
  if (!parent || Number(parent.is_parent) !== 1 || parent.parent_id) fail('O produto selecionado não é pai de uma família.', 409);
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > 100) fail('Selecione de 1 a 100 variações.');
  const byId = new Map(children.map(child => [String(child.id), child]));
  const used = new Set();
  const changes = [];
  const snapshot = [];
  for (const selection of selections) {
    const id = String(selection?.child_id || '');
    if (used.has(id)) fail('A variação foi selecionada mais de uma vez.');
    used.add(id);
    const child = byId.get(id);
    if (!child || String(child.parent_id) !== String(parent.id) || Number(child.is_parent) === 1) fail('Variação não pertence a esta família.', 409);
    if (parent.company_id && child.company_id && String(parent.company_id) !== String(child.company_id)) fail('Variação pertence a outra empresa.', 409);
    const fields = selection?.fields;
    if (!Array.isArray(fields) || (!fields.length && typeof selection.inherit_cost !== 'boolean') || fields.some(field => !Object.hasOwn(FIELDS, field)) || new Set(fields).size !== fields.length) fail('Selecione campos válidos para cada variação.');
    const current = {};
    const target = {};
    const changed = {};
    if (typeof selection.inherit_cost === 'boolean') {
      current.custom_fields = customFields(child);
      target.custom_fields = { ...current.custom_fields, inherit_parent_cost: selection.inherit_cost };
      if (inheritsParentCost(child) !== selection.inherit_cost) changed.custom_fields = { from: current.custom_fields, to: target.custom_fields };
      if (selection.inherit_cost && !fields.includes('price_cost')) fail('Selecione o custo para ativar a herança.');
    }
    for (const field of fields.slice().sort()) {
      if (field === 'price_cost' && (!Number.isSafeInteger(parent.price_cost) || parent.price_cost < 0)) fail('Informe um custo válido no pai antes de aplicar às variações.');
      current[field] = child[field] ?? null;
      target[field] = parent[field] ?? null;
      if (JSON.stringify(current[field]) !== JSON.stringify(target[field])) changed[field] = { from: current[field], to: target[field] };
    }
    snapshot.push({ child_id: id, parent_id: child.parent_id, fields: fields.slice().sort(), current, target });
    changes.push({ child_id: id, sku: child.sku, name: child.name, changed });
  }
  snapshot.sort((a, b) => a.child_id.localeCompare(b.child_id));
  changes.sort((a, b) => a.child_id.localeCompare(b.child_id));
  const fingerprint = createHash('sha256').update(JSON.stringify({ parent_id: parent.id, snapshot })).digest('hex');
  return { fingerprint, changes, changed_count: changes.filter(row => Object.keys(row.changed).length).length };
}

module.exports = { FIELDS, buildFamilyInheritancePlan, customFields, inheritsParentCost, inheritedCostPatch };
