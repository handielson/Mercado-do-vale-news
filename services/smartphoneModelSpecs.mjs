// Technical characteristics belong to the model. Product specs store only
// configuration, physical-unit data and operational metadata for smartphones.
const VARIATION_KEYS = new Set(['ram', 'ram_fisica', 'physical_ram', 'memoria_ram', 'memoria_ram_fisica', 'memory_ram', 'storage', 'armazenamento', 'memoria', 'capacity', 'color', 'cor', 'colour', 'color_id', 'version', 'versao', 'imei1', 'imei2', 'imei_1', 'imei_2', 'serial', 'serial_number', 'battery_health', 'saude_bateria', 'ean', 'gtin', 'sku', 'condition', 'condicao']);
const OPERATIONAL_KEYS = new Set(['mercado_livre', 'bling_family', 'ncm', 'cest', 'origin', 'origem', 'inmetro', 'certificado_inmetro', 'weight_kg', 'dimensions', 'slug', 'meta_title', 'meta_description', 'keywords', 'has_video', 'model', 'model_id', 'brand', 'brand_id', 'category_id', 'featured', 'inherit_parent_cost']);
const normalizeKey = key => String(key).replace(/^specs\./, '');
export function specObject(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return {}; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function isVariationSpec(key) { return VARIATION_KEYS.has(normalizeKey(key)); }
function isOperationalSpec(key) {
  return key.startsWith('_') || OPERATIONAL_KEYS.has(key) || /^(price_|dimensions\.|shopee_|bling_|tiktok_|ml_|warranty_|image|video_|blueprint_|catalog_|is_|hide_)/.test(key);
}
const PHONE_TECH_KEYS = new Set(['rede_operadora', 'network', 'rede', 'nfc', 'tem_nfc', 'celular_nfc', 'chipset', 'processador', 'battery_mah', 'bateria', 'display', 'tipo_de_display', 'fps_do_display', 'celular_fps_display', 'antutu', 'celular_biometria', 'tipo_bluetooth_celular', 'cam_principal_mpx', 'cam_selfie_mpx', 'carregamento', 'celular_tipo_de_protecao_de_tela', 'resistencia', 'resolucao_video_celular', 'celular_slot_para_cartao', 'wifi_celulares']);
export function stripModelTechnicalCustomFields(customFields, template, specs = {}) {
  const technical = new Set([...PHONE_TECH_KEYS, ...Object.keys(modelTechnicalSpecs(template)),
    ...Object.keys(specObject(specs)).map(normalizeKey).filter(key => !isVariationSpec(key) && !isOperationalSpec(key))]);
  return Object.fromEntries(Object.entries(specObject(customFields)).filter(([key]) => !technical.has(normalizeKey(key))));
}
export function isSmartphoneModel(model = {}) {
  const category = String(model.category_name || model.__category_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return /^(celulares?|smartphones?)(?:\b|$)/.test(category);
}
export function modelTechnicalSpecs(template) {
  const result = {};
  for (const [originalKey, value] of Object.entries(specObject(template))) {
    const key = normalizeKey(originalKey);
    if (isVariationSpec(key) || isOperationalSpec(key) || value == null || value === '') continue;
    if (key === 'fps_do_display') {
      if (!specObject(template).celular_fps_display && !specObject(template)['specs.celular_fps_display']) {
        const rate = String(value).match(/\d+(?:[.,]\d+)?/);
        if (rate) result.celular_fps_display = `${rate[0].replace(',', '.')} Hz`;
      }
    } else result[key] = value;
  }
  return result;
}
export function stripModelOwnedSpecs(specs, template, preserveFinancialIdentity = true) {
  const original = specObject(specs);
  const retained = Object.fromEntries(Object.entries(original).filter(([originalKey]) => {
    const key = normalizeKey(originalKey);
    return isVariationSpec(key) || isOperationalSpec(key);
  }));
  // This is a historical financial discriminator, never the public network.
  // Freeze the same value configuration() used before projecting model specs.
  if (preserveFinancialIdentity && !Object.prototype.hasOwnProperty.call(original, '_price_group_network')) {
    const keys = ['rede_operadora', 'network', 'rede'];
    const legacy = keys.map(key => original[key]).find(value => value != null && value !== '');
    const modelValue = keys.map(key => specObject(template)[key]).find(value => value != null && value !== '');
    if (legacy !== undefined || arguments.length > 1) retained._price_group_network = legacy ?? modelValue ?? '';
  }
  return retained;
}
export function resolveSmartphoneSpecs(specs, template) {
  return { ...stripModelOwnedSpecs(specs, template), ...modelTechnicalSpecs(template) };
}
export function applySmartphoneModelSpecs(product, model) {
  if (Number(product.is_print3d) === 1 || Number(product.is_combo) === 1 || product.offer_type) return product;
  if (!isSmartphoneModel(model) && !(product.model_specs_authoritative === true && !model.id && !model.category_name)) return product;
  const template = specObject(model.template_values);
  return { ...product, specs: resolveSmartphoneSpecs(product.specs, template),
    custom_fields: stripModelTechnicalCustomFields(product.custom_fields, template, product.specs),
    model_template_values: modelTechnicalSpecs(template), model_specs_authoritative: true };
}
// One batched lookup also handles models whose entire technical template is empty.
export async function applyModelSpecsToProducts(db, products) {
  if (!products.length) return products;
  const ids = [...new Set(products.map(p => p.id).filter(Boolean))];
  if (!ids.length) return products;
  const [models] = await db.query(`SELECT p.id AS product_id,m.id,m.template_values,COALESCE(mc.name,c.name) AS category_name
    FROM products p LEFT JOIN models m ON m.id=p.model_id
    LEFT JOIN categories mc ON mc.id=m.category_id LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.id IN (${ids.map(() => '?').join(',')})`, ids);
  const byId = new Map(models.map(model => [String(model.product_id), model]));
  return products.map(product => applySmartphoneModelSpecs(product, byId.get(String(product.id)) || {}));
}

// SQL candidate selection must use the same authority as the returned projection.
// Keep locally searchable configuration; never search stale phone technical copies.
export function smartphoneCatalogSearchSql(productAlias = 'products') {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(productAlias)) throw new Error('Invalid product SQL alias');
  const p = productAlias;
  const jsonPath = key => `'$."${key}"'`;
  const variants = column => `JSON_OBJECT(${[...VARIATION_KEYS].flatMap(key => [
    `'${key}'`, `COALESCE(JSON_EXTRACT(${p}.${column}, ${jsonPath(key)}), JSON_EXTRACT(${p}.${column}, ${jsonPath(`specs.${key}`)}))`,
  ]).join(', ')})`;
  const removed = [...new Set([...VARIATION_KEYS, ...OPERATIONAL_KEYS, 'fps_do_display'])]
    .flatMap(key => [jsonPath(key), jsonPath(`specs.${key}`)]).join(', ');
  const phone = `COALESCE(${p}.is_print3d,0)=0 AND COALESCE(${p}.is_combo,0)=0 AND EXISTS (
    SELECT 1 FROM categories pc LEFT JOIN models pm ON pm.id=${p}.model_id
    WHERE pc.id=COALESCE(pm.category_id,${p}.category_id)
      AND LOWER(TRIM(pc.name)) REGEXP '^(celulares?|smartphones?)([^a-z]|$)')`;
  const technical = `(SELECT JSON_REMOVE(COALESCE(pm.template_values,JSON_OBJECT()), ${removed}) FROM models pm WHERE pm.id=${p}.model_id LIMIT 1)`;
  const networkValue = `(SELECT COALESCE(${['rede_operadora', 'specs.rede_operadora', 'network', 'rede'].map(key => `NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pm.template_values,${jsonPath(key)})),'null')`).join(',')},'') FROM models pm WHERE pm.id=${p}.model_id LIMIT 1)`;
  return {
    specs: `(CASE WHEN ${phone} THEN CAST(JSON_MERGE_PATCH(COALESCE(${technical},JSON_OBJECT()),${variants('specs')}) AS CHAR) ELSE CAST(${p}.specs AS CHAR) END)`,
    customFields: `(CASE WHEN ${phone} THEN CAST(${variants('custom_fields')} AS CHAR) ELSE CAST(${p}.custom_fields AS CHAR) END)`,
    network: value => {
      if (!['4G', '5G'].includes(value)) throw new Error('Invalid network query');
      const digit = value[0];
      return `(${phone} AND LOWER(COALESCE(${networkValue},'')) REGEXP '(^|[^a-z0-9])${digit}[[:space:]]*g([^a-z0-9]|$)'
        AND LOWER(COALESCE(${networkValue},'')) NOT REGEXP '(nao|não|sem|not|no)[[:space:]]+((suporta|suporte|support)[[:space:]]+(a[[:space:]]+)?)?${digit}[[:space:]]*g([^a-z0-9]|$)')`;
    },
  };
}
