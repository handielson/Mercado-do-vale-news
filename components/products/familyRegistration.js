import { buildProductVariationPrefill } from '../../services/productClonePrefill.js';
import { DEFAULT_PRODUCT_VERSION } from '../../services/smartphoneModelSpecs.mjs';

export const FAMILY_VARIATION_ATTRIBUTES = Object.freeze([
  { key: 'color', label: 'Cor' },
  { key: 'material', label: 'Material' },
  { key: 'finish', label: 'Acabamento' },
  { key: 'storage', label: 'Armazenamento' },
  { key: 'ram', label: 'Memória RAM' },
]);
export const FAMILY_INHERITANCE_GROUPS = Object.freeze({
  prices: ['price_retail', 'price_reseller', 'price_wholesale'],
  measurements: ['dimensions', 'weight_kg'],
  details: ['brand', 'category_id', 'condition', 'unit'],
  seo: ['meta_title', 'meta_description', 'keywords'],
});

const FAMILY_SALE_PRICE_FIELDS = FAMILY_INHERITANCE_GROUPS.prices;
export function smartphoneFamilyConfigurationKey(data) {
  const specs = data?.specs || {};
  const clean = value => String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '');
  const ram = clean(specs.ram_fisica || specs.ram);
  const storage = clean(specs.storage);
  if (!ram || !storage) return '';
  return [ram, storage, clean(specs.version || specs.versao || DEFAULT_PRODUCT_VERSION), clean(specs._price_group_network || specs.rede_operadora || specs.network), clean(specs.condition || specs.condicao || 'new')].join('|');
}

export function setSmartphoneFamilyConfigurationPrice(rows, sourceKey, field, value) {
  if (!FAMILY_SALE_PRICE_FIELDS.includes(field)) throw new Error('Campo de preço inválido.');
  const source = rows.find(row => row.key === sourceKey);
  const group = smartphoneFamilyConfigurationKey(source?.data);
  if (!group) throw new Error('Preencha RAM e armazenamento da variação antes dos preços.');
  return rows.map(row => {
    if (row.data.id || smartphoneFamilyConfigurationKey(row.data) !== group) return row;
    const inherited = row.data.specs?._inherit_parent_fields || [];
    return { ...row, data: { ...row.data, [field]: value, specs: {
      ...row.data.specs, _inherit_parent_fields: inherited.filter(name => !FAMILY_SALE_PRICE_FIELDS.includes(name)),
    } } };
  });
}

export function validateNewSmartphoneFamilyPrices(rows) {
  const groups = new Map();
  for (const row of rows.filter(item => !item.data.id)) {
    const key = smartphoneFamilyConfigurationKey(row.data);
    if (!key) throw new Error(`Complete RAM e armazenamento de ${row.data.name} antes de salvar.`);
    const values = FAMILY_SALE_PRICE_FIELDS.map(field => row.data[field]);
    if (values.some(value => !Number.isSafeInteger(value) || value <= 0)) {
      throw new Error(`Informe varejo, revenda e atacado acima de zero para ${row.data.name}.`);
    }
    if (values[0] < values[1] || values[1] < values[2]) {
      throw new Error(`Confira a ordem dos preços de ${row.data.name}: varejo ≥ revenda ≥ atacado.`);
    }
    if (groups.has(key) && groups.get(key).some((value, index) => value !== values[index])) {
      throw new Error(`Cores da mesma configuração de ${row.data.name} têm preços diferentes.`);
    }
    groups.set(key, values);
  }
}

// Publish complete configurations independently; unfinished groups remain private.
export function partitionSmartphoneFamilyRowsForSave(rows) {
  const pendingGroups = new Set();
  for (const row of rows.filter(item => !item.data.id)) {
    const group = smartphoneFamilyConfigurationKey(row.data);
    const values = FAMILY_SALE_PRICE_FIELDS.map(field => row.data[field]);
    if (values.some(value => value != null && value !== '' && (!Number.isSafeInteger(value) || value < 0))) {
      throw new Error(`Confira os preços de ${row.data.name}: use valores válidos acima de zero.`);
    }
    if (!group || values.some(value => !Number.isSafeInteger(value) || value <= 0)) pendingGroups.add(group);
  }
  const pending = rows.filter(row => !row.data.id && pendingGroups.has(smartphoneFamilyConfigurationKey(row.data)));
  const pendingKeys = new Set(pending.map(row => row.key));
  const ready = rows.filter(row => !pendingKeys.has(row.key));
  validateNewSmartphoneFamilyPrices(ready);
  return { ready, pending };
}

export function validateFamilyIdentifiers(parent, rows) {
  const skus = new Set();
  if (parent.sku?.trim()) skus.add(parent.sku.trim().toLocaleUpperCase('pt-BR'));
  const eans = new Set();
  for (const row of rows) {
    const sku = row.data.sku?.trim().toLocaleUpperCase('pt-BR');
    if (sku && skus.has(sku)) throw new Error('Cada variação deve ter um SKU próprio, diferente do pai e das demais variações.');
    if (!row.data.id && row.data.specs?._sku_from_parent === true && parent.sku && sku && !sku.startsWith(parent.sku.trim().toLocaleUpperCase('pt-BR') + '-')) throw new Error('O SKU da nova variação deve começar com o SKU do pai seguido de um complemento (ex.: MINI0001-01).');
    if (sku) skus.add(sku);
    for (const ean of row.data.eans || []) {
      if (!ean) continue;
      if (!/^\d{13}$/.test(ean)) throw new Error('O EAN da variação deve ter 13 dígitos.');
      if (eans.has(ean)) throw new Error('O mesmo EAN não pode se repetir nas variações desta família.');
      eans.add(ean);
    }
  }
}

export function buildAttributeVariationDraft(parent, attributes, rows = [], identifiers = {}) {
  if (!parent.name?.trim()) throw new Error('Preencha o nome do produto pai.');
  if (!attributes.length) throw new Error('Informe pelo menos um atributo.');
  const keys = new Set();
  const specs = {};
  const values = [];
  for (const attribute of attributes) {
    if (!FAMILY_VARIATION_ATTRIBUTES.some(item => item.key === attribute.key) || keys.has(attribute.key))
      throw new Error('Selecione atributos diferentes e válidos.');
    const value = String(attribute.value || '').trim();
    if (!value || value.length > 80) throw new Error('Preencha o valor de cada atributo (até 80 caracteres).');
    keys.add(attribute.key); specs[attribute.key] = value; values.push(value);
  }
  const normalized = value => String(value || '').trim().toLocaleLowerCase('pt-BR');
  if (rows.some(row => [...keys].every(key => normalized(row.data.specs?.[key]) === normalized(specs[key]))))
    throw new Error('Já existe uma variação com esses atributos.');
  const data = buildProductVariationPrefill(parent);
  // Keep the existing full form compatible when explicitly editing advanced details.
  data.product_format = 'simple';
  data.name = `${data.name} - ${values.join(' / ')}`;
  data.specs = { ...data.specs, ...specs };
  data.sku = String(identifiers.sku || '').trim();
  data.eans = (identifiers.eans || []).filter(Boolean);
  data.images = identifiers.inheritImages === false ? [...(identifiers.images || [])] : [...(parent.images || [])];
  data.video_url = String(identifiers.videoUrl || '').trim() || null;
  const ownSpecs = data.specs;
  if (identifiers.listing) {
    Object.assign(data, identifiers.listing);
    data.specs = { ...ownSpecs, ...(identifiers.listing.specs || {}) };
  }
  data.specs._inherit_parent_fields ??= Object.values(FAMILY_INHERITANCE_GROUPS).flat();
  data.specs._inherit_parent_video = identifiers.inheritVideo === true;
  data.specs._sku_from_parent = true;
  validateFamilyIdentifiers(parent, [...rows, { data }]);
  return data;
}

// Add one real memory configuration to several colors without crossing unrelated
// RAM/storage pairs or replacing identifiers and media already entered in drafts.
export function addSmartphoneFamilyConfiguration(parent, rows, { colors, ram, storage }, makeKey) {
  const clean = value => String(value || '').trim();
  const normalized = value => clean(value).toLocaleLowerCase('pt-BR').replace(/\s+/g, '');
  ram = clean(ram); storage = clean(storage);
  const selected = [...new Map(colors.map(color => [normalized(color), clean(color)])).values()].filter(Boolean);
  if (!selected.length || !ram || !storage) throw new Error('Selecione as cores, a memória RAM e o armazenamento.');
  const next = [...rows];
  let added = 0, completed = 0, skipped = 0;
  for (const color of selected) {
    const sameColor = row => normalized(row.data.specs?.color) === normalized(color);
    if (next.some(row => sameColor(row) && normalized(row.data.specs?.ram_fisica || row.data.specs?.ram) === normalized(ram) && normalized(row.data.specs?.storage) === normalized(storage))) {
      skipped++; continue;
    }
    const incomplete = next.findIndex(row => !row.data.id && sameColor(row) &&
      (!row.data.specs?.ram || !row.data.specs?.storage) &&
      (!row.data.specs?.ram || normalized(row.data.specs.ram) === normalized(ram)) &&
      (!row.data.specs?.storage || normalized(row.data.specs.storage) === normalized(storage)));
    if (incomplete >= 0) {
      const row = next[incomplete];
      const specs = { ...row.data.specs, ram, storage };
      if (specs.ram_fisica) specs.ram_fisica = ram;
      const base = buildProductVariationPrefill(parent).name;
      next[incomplete] = { ...row, data: { ...row.data, specs, name: `${base} - ${[color, ram, storage].join(' / ')}` } };
      completed++;
    } else {
      const source = rows.find(sameColor);
      const inheritImages = source?.inheritImages ?? true;
      const data = buildAttributeVariationDraft(parent, [{ key: 'color', value: color }, { key: 'ram', value: ram }, { key: 'storage', value: storage }], next, {
        inheritImages, images: source?.data.images || [],
      });
      if (data.specs.ram_fisica) data.specs.ram_fisica = ram;
      next.push({ key: makeKey(), data, inheritImages });
      added++;
    }
  }
  return { rows: next, added, completed, skipped };
}

// Photos registered on the commercial model imply sellable color drafts. Keep
// existing family configurations (including multiple memories per color) intact.
export function buildModelPhotoVariationRows(parent, rows, colors, imageRows) {
  if (!parent?.name?.trim() || !parent?.model_id) return [];
  const names = new Map(colors.map(color => [color.id, color.name]));
  const knownColors = new Set(rows.map(row => String(row.data.specs?.color || '').trim().toLocaleLowerCase('pt-BR')));
  const drafts = [];
  for (const imageRow of imageRows) {
    const color = names.get(imageRow.color_id);
    const key = String(color || '').trim().toLocaleLowerCase('pt-BR');
    if (!key || knownColors.has(key) || !imageRow.images?.length) continue;
    const data = buildAttributeVariationDraft(parent, [{ key: 'color', value: color }], [...rows, ...drafts], {
      inheritImages: false, images: imageRow.images,
    });
    drafts.push({ key: `model-color:${imageRow.color_id}`, data, inheritImages: false });
    knownColors.add(key);
  }
  return drafts;
}

export function productUnitCondition(specs = {}) {
  const value = String(specs.condition || specs.condicao || 'new').toLowerCase();
  return ['used', 'usado', 'seminovo'].includes(value) ? 'used' : value === 'open_box' ? 'open_box' : 'new';
}

export function familyChildPayload(parent, child, inheritImages = true) {
  const inherited = buildProductVariationPrefill(parent);
  const selected = { ...child, specs: { ...child.specs } };
  for (const field of child.specs?._inherit_parent_fields || []) {
    if (['condition', 'unit'].includes(field)) selected.specs[field] = parent.specs?.[field] ?? '';
    else if (['price_retail', 'price_reseller', 'price_wholesale', 'dimensions', 'weight_kg', 'brand', 'category_id', 'meta_title', 'meta_description', 'keywords'].includes(field)) selected[field] = parent[field] ?? null;
  }
  return {
    ...inherited, ...selected,
    category_id: selected.category_id || parent.category_id,
    brand: selected.brand || parent.brand,
    model_id: child.model_id || parent.model_id,
    model: child.model || parent.model,
    ncm: child.ncm || parent.ncm,
    cest: child.cest || parent.cest,
    origin: child.origin || parent.origin,
    parent_id: parent.id, is_parent: false, product_format: 'variation',
    // Description remains authoritative on the parent, not a stale copied draft.
    description: child.specs?._inherit_parent_description === false ? child.description || null : null,
    video_url: child.specs?._inherit_parent_video === true ? parent.video_url || null : child.video_url || null,
    images: inheritImages ? [...(parent.images || [])] : [...(child.images || [])],
    specs: { ...(inherited.specs || {}), ...selected.specs, _inherit_parent_images: inheritImages },
    is_print3d: Boolean(parent.is_print3d),
    print3d_preorder_enabled: Boolean(parent.is_print3d),
    print3d_preorder_limit: null,
    ...(parent.is_print3d ? { production_days: null } : {}),
  };
}

// Keep confirmations outside the form draft. Retry updates confirmed rows instead
// of creating another parent/child after a partially completed request.
export async function saveFamilyRegistration(parentData, rows, checkpoint, api) {
  validateFamilyIdentifiers(parentData, rows);
  if (api.validateProduction) for (const row of rows) await api.validateProduction(row);
  for (const row of rows) {
    if (!row.videoFile || row.data.specs?._inherit_parent_video === true) continue;
    if (!api.uploadVideo || !api.validateVideo) throw new Error('Envio de vídeo não está disponível. Nenhum produto foi salvo.');
    api.validateVideo(row.videoFile);
  }
  checkpoint.parent = checkpoint.parent?.id
    ? await api.update(checkpoint.parent.id, parentData)
    : await api.create(parentData);
  if (!checkpoint.parent?.id) throw new Error('O salvamento da família não confirmou o ID.');
  for (const row of rows) {
    const payload = familyChildPayload(checkpoint.parent, row.data, row.inheritImages);
    const id = checkpoint.children[row.key]?.id || row.data.id;
    const confirmed = checkpoint.children[row.key];
    if (confirmed?.sku) payload.sku = confirmed.sku;
    const queuedVideo = row.videoFile && payload.specs?._inherit_parent_video !== true;
    checkpoint.videos ||= {};
    const previousVideo = checkpoint.videos[row.key];
    if (queuedVideo && previousVideo?.file === row.videoFile && previousVideo.sku === payload.sku && previousVideo.url) payload.video_url = previousVideo.url;
    try {
      if (!id) validateFamilyIdentifiers(checkpoint.parent, [row]);
      checkpoint.pendingUnits ||= {};
      const identity = Boolean(checkpoint.pendingUnits[row.key]) || (!row.data.id && ['serial', 'imei1', 'imei2'].some(key => payload.specs?.[key]));
      const serialSpecs = checkpoint.pendingUnits[row.key] || { ...payload.specs };
      if (identity) {
        if (!api.createUnit) throw new Error('Cadastro serializado exige gravação da unidade física.');
        checkpoint.pendingUnits[row.key] = serialSpecs;
        for (const key of ['serial', 'imei1', 'imei2']) delete payload.specs[key];
        payload.stock_quantity = 0;
      }
      const saved = id ? await api.update(id, payload) : await api.create(payload);
      if (!saved?.id) throw new Error('O salvamento não confirmou o ID.');
      checkpoint.children[row.key] = saved;
      if (api.saveProduction) await api.saveProduction(row, saved);
      if (queuedVideo) {
        if (!saved.sku) throw new Error('O sistema não confirmou o SKU definitivo para enviar o vídeo.');
        const video = previousVideo?.file === row.videoFile && previousVideo.sku === saved.sku
          ? previousVideo : { file: row.videoFile, sku: saved.sku };
        checkpoint.videos[row.key] = video;
        if (!video.url) {
          try {
            video.url = await api.uploadVideo(row.videoFile, saved.sku, {
              uploadId: video.uploadId, onAccepted: uploadId => { video.uploadId = uploadId; },
            });
            if (!video.url) throw new Error('O envio não confirmou o endereço do vídeo.');
          } catch (error) {
            // A failed NAS job may be retried; a timeout/network failure must
            // resume that same job instead of uploading the file again.
            if (error.uploadFailed) delete video.uploadId;
            throw error;
          }
        }
        const linked = await api.update(saved.id, { ...payload, sku: saved.sku, name: saved.name, video_url: video.url });
        if (!linked?.id || linked.video_url !== video.url) throw new Error('O cadastro não confirmou o vínculo do vídeo. Tente salvar novamente.');
        checkpoint.children[row.key] = linked;
      } else if (!saved.video_url && saved.sku && payload.specs?._inherit_parent_video !== true && api.checkVideo) {
        const video = await api.checkVideo(saved.sku);
        if (video?.exists && video.url) {
          checkpoint.children[row.key] = await api.update(saved.id, { ...payload, sku: saved.sku, name: saved.name, video_url: video.url });
        }
      }
      checkpoint.units ||= {};
      if (identity && !checkpoint.units[row.key]) {
        const unit = await api.createUnit({ product_id: saved.id,
          serial_number: serialSpecs.serial || undefined, imei_1: serialSpecs.imei1 || undefined,
          imei_2: serialSpecs.imei2 || undefined, condition: productUnitCondition(serialSpecs),
          status: 'available', cost_price: payload.price_cost });
        if (!unit?.id) throw new Error('A unidade física não confirmou o ID.');
        checkpoint.units[row.key] = unit;
        delete checkpoint.pendingUnits[row.key];
      }
    } catch (error) {
      throw new Error(`Família salva. Falha na variação "${row.data.name}": ${error.message}. Os dados foram mantidos; tente salvar novamente.`);
    }
  }
  return checkpoint.parent;
}
