function normalizeTemplateText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractPhoneModel(product) {
  const text = String(product?.name || '');
  const normalized = normalizeTemplateText(text);

  const patterns = [
    /\b(redmi\s+note\s+\d{1,2}(?:\s+pro)?(?:\s+plus)?)/i,
    /\b(redmi\s+\d{1,2}[a-z]?(?:\s+pro)?(?:\s+plus)?)/i,
    /\b(poco\s+[a-z0-9]+(?:\s+pro)?)/i,
    /\b(galaxy\s+[a-z]\d{1,2}(?:\s+plus| ultra| fe)?)/i,
    /\b(iphone\s+\d{1,2}(?:\s+pro)?(?:\s+max)?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/\s+/g, ' ').trim();
    }
  }

  if (normalized.includes('redmi note')) return 'Redmi Note';
  if (normalized.includes('iphone')) return 'iPhone';
  if (normalized.includes('galaxy')) return 'Galaxy';
  return '';
}

function isPhoneCaseProduct(product) {
  const text = normalizeTemplateText([
    product?.name,
    product?.sku,
    product?.category_slug,
  ].join(' '));

  return (
    /\b(capa|case|capinha|cover)\b/.test(text) &&
    !/\b(pelicula|carregador|fone|cabo)\b/.test(text)
  );
}

function isPowerSupplyProduct(product) {
  const text = normalizeTemplateText([
    product?.name,
    product?.sku,
    product?.category_slug,
  ].join(' '));

  return (
    /\b(fonte|fonte de alimentacao|power supply|adaptador)\b/.test(text) &&
    /\b(12v|24v|bivolt|pino|agulha|alimentacao|alimentador)\b/.test(text)
  );
}

const PHONE_CASE_TEMPLATE = {
  id: 'phone_case',
  label: 'Capa de celular',
  category_id: 100490,
  attribute_defaults: {
    100121: '3 Months',
    100134: 'TPU',
    100162: 'Sem',
    100370: 'Supplier Warranty',
    100470: 'Water Resistant',
    100471: 'Others',
    100503: 'Others',
    100999: 'Others',
    101219: 'Soft',
  },
};

const POWER_SUPPLY_TEMPLATE = {
  id: 'power_supply',
  label: 'Fonte de alimentacao',
  category_id: 101803,
  strict_attribute_ids: [
    100121,
    100370,
    100105,
    100323,
    101029,
    100999,
    100413,
    101219,
    101639,
    102292,
  ],
  attribute_defaults: {
    100121: '3 Months',
    100370: 'Supplier Warranty',
    101219: 'No',
    102292: 'N/A – NBR not applicable',
  },
};

function resolveShopeeFieldTemplate(product) {
  if (isPhoneCaseProduct(product)) return PHONE_CASE_TEMPLATE;
  if (isPowerSupplyProduct(product)) return POWER_SUPPLY_TEMPLATE;
  return null;
}

function findOptionValue(options, desiredValue) {
  const target = normalizeTemplateText(desiredValue);
  if (!target) return '';

  const option = (options || []).find((candidate) => {
    return [
      candidate?.label,
      candidate?.raw_name,
      candidate?.original_value_name,
      candidate?.value_id,
    ].some((value) => normalizeTemplateText(value) === target);
  });

  return option?.label || option?.original_value_name || option?.raw_name || String(desiredValue || '').trim();
}

function buildShopeeTemplateAttributeValues(attributes, product, template = resolveShopeeFieldTemplate(product)) {
  if (!template) return {};

  const values = {};
  const productBrand = String(product?.brand || '').trim();
  const phoneModel = extractPhoneModel(product);

  for (const attr of attributes || []) {
    const attrId = Number(attr?.attribute_id);
    const label = normalizeTemplateText(attr?.label);
    const configuredValue = template.attribute_defaults?.[attrId];
    let desiredValue = configuredValue || '';

    if (!desiredValue && /marca.*(celular|aplicavel|aplicavel)|cell.*brand/.test(label)) {
      desiredValue = productBrand;
    }

    if (!desiredValue && /modelo.*celular|phone.*model|modelo/.test(label)) {
      desiredValue = phoneModel;
    }

    if (!desiredValue) continue;

    const hasFixedOptions = Array.isArray(attr.attribute_value_list) && attr.attribute_value_list.length > 0;
    const optionValue = findOptionValue(attr.attribute_value_list, desiredValue);
    if (hasFixedOptions && !optionValue) continue;

    const value = optionValue || desiredValue;
    if (value) values[attrId] = value;
  }

  return values;
}

function flattenTemplateCategoryTree(categories) {
  return (categories || []).flatMap((category) => [
    category,
    ...flattenTemplateCategoryTree(category?.children || []),
  ]);
}

function findShopeeTemplateCategory(categoryTree, template) {
  if (!template?.category_id) return null;
  return flattenTemplateCategoryTree(categoryTree).find((category) => {
    return Number(category?.category_id) === Number(template.category_id);
  }) || null;
}

export {
  buildShopeeTemplateAttributeValues,
  extractPhoneModel,
  findShopeeTemplateCategory,
  isPhoneCaseProduct,
  isPowerSupplyProduct,
  resolveShopeeFieldTemplate,
};
