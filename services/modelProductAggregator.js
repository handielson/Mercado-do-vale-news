function firstText(specs, keys) {
  for (const key of keys) {
    const value = specs?.[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function slugify(value) {
  return String(value || 'produto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'produto';
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function productLinks(product) {
  const slug = product.slug || slugify(product.name || product.sku || product.id);
  const searchTerm = product.sku || product.name || product.id;
  return {
    editUrl: `/admin/products/${encodeURIComponent(product.id)}/${slug}`,
    publicUrl: `/produto/${slug}`,
    modelPanelUrl: `/admin/products/models/${encodeURIComponent(product.model_id || '')}`,
    stockLocationUrl: `/admin/inventory/locations?search=${encodeURIComponent(searchTerm)}`,
  };
}

function saleUrl(unit) {
  return unit.sale_id ? `/admin/sales?sale=${encodeURIComponent(unit.sale_id)}` : null;
}

function orderUrl(unit) {
  return unit.order_id ? `/admin/orders?order=${encodeURIComponent(unit.order_id)}` : null;
}

function emptyTotals() {
  return {
    availableCount: 0,
    soldCount: 0,
    reservedCount: 0,
    rmaCount: 0,
    stockCostValue: 0,
    investedValue: 0,
    returnedValue: 0,
  };
}

function addUnitToTotals(target, unit) {
  if (unit.status === 'available') {
    target.availableCount += 1;
    target.stockCostValue += unit.costValue;
  }
  if (unit.status === 'sold') {
    target.soldCount += 1;
    target.returnedValue += unit.returnedValue;
  }
  if (unit.status === 'reserved') target.reservedCount += 1;
  if (unit.status === 'rma') target.rmaCount += 1;
  if (['available', 'reserved', 'sold', 'rma'].includes(unit.status)) {
    target.investedValue += unit.costValue;
  }
}

export function getProductVariationSpecs(product) {
  const specs = product?.specs || {};
  return {
    ram: firstText(specs, ['ram', 'RAM', 'memory_ram', 'memoria_ram']),
    storage: firstText(specs, ['storage', 'Storage', 'capacity', 'armazenamento', 'memoria']),
    color: firstText(specs, ['color', 'Cor', 'cor', 'colour']),
  };
}

export function aggregateModelProducts(input) {
  const saleReturnByUnitId = input.saleReturnByUnitId || {};
  const locationsByProductId = input.locationsByProductId || {};
  const unitsByProductId = new Map();

  for (const unit of input.units || []) {
    const productId = String(unit.product_id || unit.productId || '');
    if (!unitsByProductId.has(productId)) unitsByProductId.set(productId, []);
    unitsByProductId.get(productId)?.push(unit);
  }

  const memoryGroupMap = new Map();

  for (const product of input.products || []) {
    const { ram, storage, color } = getProductVariationSpecs(product);
    const missingFields = [
      !ram ? 'ram' : '',
      !storage ? 'storage' : '',
      !color ? 'color' : '',
    ].filter(Boolean);
    const memoryKey = missingFields.length
      ? `incomplete|${normalizeKey(ram)}|${normalizeKey(storage)}|${normalizeKey(product.id)}`
      : `${normalizeKey(ram)}|${normalizeKey(storage)}`;

    let memoryGroup = memoryGroupMap.get(memoryKey);
    if (!memoryGroup) {
      memoryGroup = {
        key: memoryKey,
        ram: ram || 'Dados incompletos',
        storage: storage || 'Dados incompletos',
        isIncomplete: missingFields.length > 0,
        missingFields,
        products: [],
        colors: [],
        ...emptyTotals(),
      };
      memoryGroupMap.set(memoryKey, memoryGroup);
    }

    const links = productLinks(product);
    const productView = {
      id: String(product.id),
      name: String(product.name || ''),
      sku: String(product.sku || ''),
      slug: String(product.slug || slugify(product.name || product.sku || product.id)),
      editUrl: links.editUrl,
      publicUrl: links.publicUrl,
      modelPanelUrl: links.modelPanelUrl,
      stockLocationUrl: links.stockLocationUrl,
      priceCost: Number(product.price_cost || 0),
      priceRetail: Number(product.price_retail || 0),
      status: String(product.status || ''),
      raw: product,
    };
    memoryGroup.products.push(productView);

    const colorKey = `${memoryKey}|${normalizeKey(color || 'Dados incompletos')}`;
    let colorGroup = memoryGroup.colors.find((group) => group.key === colorKey);
    if (!colorGroup) {
      colorGroup = {
        key: colorKey,
        color: color || 'Dados incompletos',
        products: [],
        units: [],
        locations: [],
        ...emptyTotals(),
      };
      memoryGroup.colors.push(colorGroup);
    }
    colorGroup.products.push(productView);
    colorGroup.locations.push(...(locationsByProductId[String(product.id)] || []));

    const productUnits = unitsByProductId.get(String(product.id)) || [];
    for (const unit of productUnits) {
      const status = String(unit.status || '').toLowerCase();
      const costValue = Number(unit.cost_price ?? product.price_cost ?? 0);
      const explicitReturn = saleReturnByUnitId[String(unit.id)];
      const returnedValueEstimated = explicitReturn == null && status === 'sold';
      const unitView = {
        id: String(unit.id || ''),
        productId: String(product.id || ''),
        imei1: String(unit.imei_1 || unit.imei1 || ''),
        imei2: String(unit.imei_2 || unit.imei2 || ''),
        serial: String(unit.serial_number || unit.serial || ''),
        status,
        locationId: unit.location_id || null,
        depositId: unit.deposit_id || null,
        saleId: unit.sale_id || null,
        orderId: unit.order_id || null,
        costValue,
        returnedValue: Number(explicitReturn ?? (returnedValueEstimated ? product.price_retail || 0 : 0)),
        returnedValueEstimated,
        saleUrl: saleUrl(unit),
        orderUrl: orderUrl(unit),
        raw: unit,
      };
      colorGroup.units.push(unitView);
      addUnitToTotals(colorGroup, unitView);
      addUnitToTotals(memoryGroup, unitView);
    }
  }

  const memoryGroups = [...memoryGroupMap.values()]
    .map((memoryGroup) => ({
      ...memoryGroup,
      colors: memoryGroup.colors.sort((a, b) => a.color.localeCompare(b.color)),
    }))
    .sort((a, b) => {
      if (a.isIncomplete !== b.isIncomplete) return a.isIncomplete ? 1 : -1;
      return `${a.ram} ${a.storage}`.localeCompare(`${b.ram} ${b.storage}`);
    });

  const totals = emptyTotals();
  for (const group of memoryGroups) {
    totals.availableCount += group.availableCount;
    totals.soldCount += group.soldCount;
    totals.reservedCount += group.reservedCount;
    totals.rmaCount += group.rmaCount;
    totals.stockCostValue += group.stockCostValue;
    totals.investedValue += group.investedValue;
    totals.returnedValue += group.returnedValue;
  }

  return {
    model: input.model,
    totals,
    memoryGroups,
  };
}
