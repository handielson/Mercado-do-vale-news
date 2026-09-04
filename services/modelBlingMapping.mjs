// Explicit ESM extension: shared by Vite and the CommonJS production API.
export const normalizeMappingText = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
export const normalizeMappingMemory = value => normalizeMappingText(value).replace(/\s+/g, '').replace(/^(\d+)$/, '$1GB');

export function intakeMappingKey(intake) {
  const values = [intake.company_id || '', intake.matched_model_id, intake.matched_color_id,
    normalizeMappingMemory(intake.detected_ram), normalizeMappingMemory(intake.detected_storage)];
  return values.slice(1).every(Boolean) ? JSON.stringify(values) : null;
}

export function getIntakeBlingChild(family, intake) {
  const key = intakeMappingKey(intake);
  if (!key || !family?.parent_id) return null;
  const mapping = (family.mappings || []).find(row => row.key === key);
  return (family.children || []).find(child => String(child.id) === String(mapping?.child_id)
    && child.sku && child.active !== false) || null;
}

export function saveIntakeBlingMapping(family, intake, childId) {
  const key = intakeMappingKey(intake);
  const child = (family?.children || []).find(row => String(row.id) === String(childId) && row.sku && row.active !== false);
  if (!key || !child || !family?.parent_id) throw new Error('Confira modelo, cor, RAM e armazenamento e selecione um filho válido.');
  return { ...family, mappings: [...(family.mappings || []).filter(row => row.key !== key), {
    key, child_id: child.id, color: intake.detected_color, ram: normalizeMappingMemory(intake.detected_ram),
    storage: normalizeMappingMemory(intake.detected_storage),
  }] };
}

export function buildBlingFamily(parent, payload, previous) {
  const data = payload?.data || payload;
  const rows = Array.isArray(data) ? data : data?.variacoes;
  if (!parent?.id || !parent.codigo || parent.variacao?.produtoPai?.id || !Array.isArray(rows) || !rows.length) {
    throw new Error('Informe o SKU de um pai com variações cadastradas no Bling.');
  }
  const children = rows.map(row => row.produto || row).map(row => ({
    id: Number(row.id), sku: String(row.codigo || '').trim(), name: String(row.nome || row.variacao?.nome || ''),
    active: !row.situacao || row.situacao === 'A',
  }));
  if (children.some(child => !Number.isSafeInteger(child.id) || child.id <= 0 || !child.sku || child.id === Number(parent.id))
      || new Set(children.map(child => child.id)).size !== children.length) {
    throw new Error('O Bling retornou variações incompletas. Atualize a consulta antes de salvar.');
  }
  return { parent_id: Number(parent.id), parent_sku: parent.codigo, parent_name: parent.nome, children,
    mappings: String(previous?.parent_id) === String(parent.id) ? (previous.mappings || []).filter(
      row => children.some(child => String(child.id) === String(row.child_id) && child.active)) : [] };
}

export function photoQueueGroupKey(item) {
  if (!['waiting_model_registration', 'waiting_price_confirmation', 'review_required', 'ready_to_finalize'].includes(item.status)) return `item:${item.id}`;
  const model = item.matched_model_id || [normalizeMappingText(item.detected_brand), normalizeMappingText(item.detected_model)].filter(Boolean).join(':');
  const color = item.matched_color_id || normalizeMappingText(item.detected_color);
  const ram = normalizeMappingMemory(item.detected_ram);
  const storage = normalizeMappingMemory(item.detected_storage);
  if (!model || !color || !ram || !storage || (!item.matched_model_id && (!item.detected_brand || !item.detected_model))) return `item:${item.id}`;
  return JSON.stringify([item.company_id || '', model, ram, storage, color]);
}
