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

function moneyToCents(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return Number.isInteger(value) ? value : Math.round(value * 100);
  }

  const clean = String(value).trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!clean) return 0;

  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');
  const decimalDotMatch = !hasComma ? clean.match(/\.(\d{1,2})$/u) : null;
  const decimalDot = Boolean(decimalDotMatch && decimalDotMatch[1] !== '00');
  const normalized = hasComma
    ? clean.replace(/\./g, '').replace(',', '.')
    : decimalDotMatch && decimalDotMatch[1] === '00'
      ? clean.slice(0, -3).replace(/[.,]/g, '')
      : clean.replace(decimalDot ? /,/g : /[.,]/g, '');

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return 0;
  return (hasComma || (hasDot && decimalDot)) ? Math.round(numeric * 100) : Math.round(numeric);
}

function moneyReaisToCents(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : 0;

  const clean = String(value).trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!clean) return 0;

  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean.replace(/,/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function looksLikeCentStoredMoney(value) {
  const n = Math.abs(Number(value));
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) <= 0.001 && n >= 1000;
}

function saleRowUsesLegacyDecimalItemMoney(saleRow) {
  if (!saleRow) return false;
  const hasModernSubtotal = Number(saleRow.subtotal || 0) > 0;
  const hasModernPaymentMethods = saleRow.payment_methods != null && saleRow.payment_methods !== '';
  const totalLooksDecimalReais = typeof saleRow.total === 'string'
    && /\.\d{2}$/u.test(saleRow.total)
    && !looksLikeCentStoredMoney(saleRow.total);
  return totalLooksDecimalReais && !hasModernSubtotal && !hasModernPaymentMethods;
}

function saleItemMoneyToCents(value, saleRow) {
  const legacyDecimalText = typeof value === 'string' && /[,.]\d{1,2}$/u.test(value.trim());
  return saleRowUsesLegacyDecimalItemMoney(saleRow) && legacyDecimalText ? moneyReaisToCents(value) : moneyToCents(value);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
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

function displaySaleNumber(saleId) {
  const value = String(saleId || '').trim();
  if (!value) return '';
  return isUuid(value) ? `PDV-${value.slice(0, 8).toUpperCase()}` : value;
}

function saleCustomerName(sale, customerById = new Map()) {
  const customerId = String(sale?.customer_id || sale?.customerId || '').trim();
  const customer = customerId ? customerById.get(customerId) : null;
  return String(
    sale?.customer_name ||
    sale?.customerName ||
    sale?.customer?.name ||
    customer?.name ||
    sale?.buyer_name ||
    sale?.buyerName ||
    ''
  ).trim();
}

function emptyTotals() {
  return {
    availableCount: 0,
    soldCount: 0,
    reservedCount: 0,
    rmaCount: 0,
    stockCostValue: 0,
    averageStockCost: 0,
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

function resetTotals(target) {
  const totals = emptyTotals();
  for (const [key, value] of Object.entries(totals)) target[key] = value;
}

function addTotals(target, source) {
  target.availableCount += source.availableCount;
  target.soldCount += source.soldCount;
  target.reservedCount += source.reservedCount;
  target.rmaCount += source.rmaCount;
  target.stockCostValue += source.stockCostValue;
  target.investedValue += source.investedValue;
  target.returnedValue += source.returnedValue;
}

function normalizeLocation(location) {
  const depositName = location.deposit_name || location.deposit?.name || 'Deposito';
  const rawLocationName = location.location_name || location.location?.name || '';
  const locationName = rawLocationName && !isUuid(rawLocationName) ? rawLocationName : 'Local sem nome';
  const quantity = Number(location.quantity || 0);
  const reservedQuantity = Number(location.reserved_quantity || 0);
  return {
    ...location,
    depositName,
    locationName,
    label: `${depositName} / ${locationName}`,
    quantity,
    reservedQuantity,
    availableQuantity: Math.max(0, quantity - reservedQuantity),
  };
}

function locationKey(location) {
  return String(location.location_id || location.id || location.label || '').trim()
    || `${location.depositName || location.deposit_name || ''}|${location.locationName || location.location_name || ''}`;
}

function dedupeLocations(locations) {
  const byLocation = new Map();
  for (const location of locations || []) {
    const key = locationKey(location);
    const existing = byLocation.get(key);
    if (!existing) {
      byLocation.set(key, { ...location });
      continue;
    }
    existing.quantity = Math.max(Number(existing.quantity || 0), Number(location.quantity || 0));
    existing.reservedQuantity = Math.max(Number(existing.reservedQuantity || 0), Number(location.reservedQuantity || 0));
    existing.availableQuantity = Math.max(0, existing.quantity - existing.reservedQuantity);
  }
  return [...byLocation.values()];
}

function applyAverageStockCost(target) {
  target.averageStockCost = target.availableCount > 0
    ? Math.round(target.stockCostValue / target.availableCount)
    : 0;
}

function addAvailableFallback(target, quantity, costValue) {
  if (quantity <= 0) return;
  target.availableCount += quantity;
  target.stockCostValue += quantity * costValue;
  target.investedValue += quantity * costValue;
}

function addSaleStatsFallback(target, stats) {
  if (!stats || stats.soldCount <= 0) return;
  target.soldCount += stats.soldCount;
  target.investedValue += stats.investedValue;
  target.returnedValue += stats.returnedValue;
}

function isActiveSale(row) {
  const status = normalizeKey(row?.status || row?.payment_status || '');
  return !['cancelled', 'canceled', 'refunded', 'estornado', 'cancelado'].includes(status);
}

function hasSerializedUnitReference(item) {
  return Boolean(String(item?.serialized_unit_id || item?.serializedUnitId || item?.unit_id || item?.unitId || '').trim());
}

function buildSaleStatsByProduct(products, sales, saleItems) {
  if (!Array.isArray(saleItems) || saleItems.length === 0) return new Map();

  const saleById = new Map((sales || []).map((sale) => [String(sale.id || ''), sale]));
  const productById = new Map(products.map((product) => [String(product.id), product]));
  const productIdBySku = new Map();
  for (const product of products) {
    const key = normalizeKey(product.sku);
    if (key && !productIdBySku.has(key)) productIdBySku.set(key, product.id);
  }

  const statsByProductId = new Map();
  for (const item of saleItems) {
    if (hasSerializedUnitReference(item)) continue;

    const saleId = String(item.sale_id || item.saleId || '');
    const sale = saleById.get(saleId);
    if (saleById.has(saleId) && !isActiveSale(sale)) continue;

    const directProductId = String(item.product_id || item.productId || '');
    const productId = productById.has(directProductId)
      ? directProductId
      : productIdBySku.get(normalizeKey(item.product_sku || item.sku));
    if (!productId || !productById.has(productId)) continue;

    const product = productById.get(productId);
    const quantity = Math.max(0, Number(item.quantity || 0));
    if (quantity <= 0) continue;

    const unitCost = saleItemMoneyToCents(item.unit_cost ?? item.cost ?? product.price_cost ?? product.priceCost, sale);
    const unitPrice = saleItemMoneyToCents(item.unit_price ?? item.price ?? product.price_retail ?? product.priceRetail, sale);
    const returnedValue = saleItemMoneyToCents(item.total ?? item.subtotal, sale) || unitPrice * quantity;
    const current = statsByProductId.get(productId) || { soldCount: 0, investedValue: 0, returnedValue: 0 };
    current.soldCount += quantity;
    current.investedValue += unitCost * quantity;
    current.returnedValue += returnedValue;
    statsByProductId.set(productId, current);
  }

  return statsByProductId;
}

function buildSerializedSaleInfoByUnitId(sales, saleItems, customers) {
  if (!Array.isArray(saleItems) || saleItems.length === 0) return new Map();

  const saleById = new Map((sales || []).map((sale) => [String(sale.id || ''), sale]));
  const customerById = new Map((customers || []).map((customer) => [String(customer.id || ''), customer]));
  const infoByUnitId = new Map();

  for (const item of saleItems) {
    const unitId = String(item.serialized_unit_id || item.serializedUnitId || item.unit_id || item.unitId || '').trim();
    if (!unitId) continue;

    const saleId = String(item.sale_id || item.saleId || '').trim();
    const sale = saleById.get(saleId) || {};
    if (saleById.has(saleId) && !isActiveSale(sale)) continue;

    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = saleItemMoneyToCents(item.unit_price ?? item.price, sale);
    const returnedValue = saleItemMoneyToCents(item.total ?? item.subtotal, sale) || unitPrice * quantity;
    const unitReturnedValue = Math.round(returnedValue / quantity);
    const unitCost = saleItemMoneyToCents(item.unit_cost ?? item.cost, sale);
    const orderId = String(item.order_id || item.orderId || sale.order_id || sale.orderId || '').trim();
    const orderNumber = String(
      sale.order_number || sale.orderNumber || sale.number || sale.numero_pedido || item.order_number || item.orderNumber || orderId || displaySaleNumber(saleId)
    ).trim();

    infoByUnitId.set(unitId, {
      saleId,
      orderId,
      orderNumber,
      customerName: saleCustomerName(sale, customerById) || String(item.customer_name || item.customerName || '').trim(),
      returnedValue: unitReturnedValue,
      unitCost,
    });
  }

  return infoByUnitId;
}

function hasProductIdentifier(product) {
  const specs = product.raw?.specs || {};
  return Boolean(
    String(specs.imei1 || specs.imei_1 || specs.imei2 || specs.imei_2 || specs.serial || specs.serial_number || '').trim()
  );
}

function productIdentifier(product) {
  const specs = product.raw?.specs || {};
  const identifier = {
    productId: product.id,
    sku: product.sku || '',
    imei1: String(specs.imei1 || specs.imei_1 || '').trim(),
    imei2: String(specs.imei2 || specs.imei_2 || '').trim(),
    serial: String(specs.serial || specs.serial_number || '').trim(),
    editUrl: product.editUrl,
  };
  return identifier.imei1 || identifier.imei2 || identifier.serial ? identifier : null;
}

function productIdentifierUnit(product) {
  const identifier = productIdentifier(product);
  if (!identifier) return null;
  const availableCount = Number(product.availableCount || 0);
  if (!isActiveProduct(product) || (product.raw?.track_inventory && availableCount <= 0)) return null;
  return {
    id: `product-specs:${product.id}`,
    productId: String(product.id || ''),
    sku: product.sku || '',
    imei1: identifier.imei1,
    imei2: identifier.imei2,
    serial: identifier.serial,
    status: 'available',
    locationId: null,
    depositId: null,
    locationLabel: '',
    saleId: null,
    orderId: null,
    orderNumber: '',
    customerName: '',
    costValue: Number(product.priceCost || 0),
    returnedValue: 0,
    returnedValueEstimated: false,
    profitValue: 0,
    saleUrl: null,
    orderUrl: null,
    raw: product.raw,
    isProductSpecsUnit: true,
  };
}

function isActiveProduct(product) {
  return !['inactive', 'archived', 'deleted', 'sold'].includes(String(product.status || '').toLowerCase());
}

function skuKey(product) {
  return normalizeKey(product.sku) || String(product.id || '');
}

function buildSkuGroups(colorGroup) {
  const groups = new Map();
  const skuByProductId = new Map(colorGroup.products.map((product) => [String(product.id), skuKey(product)]));
  const unitCountsBySku = new Map();
  for (const unit of colorGroup.units || []) {
    if (unit.status !== 'available') continue;
    const key = skuByProductId.get(String(unit.productId || ''));
    if (!key) continue;
    unitCountsBySku.set(key, (unitCountsBySku.get(key) || 0) + 1);
  }

  for (const product of colorGroup.products) {
    const key = skuKey(product);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        sku: product.sku || 'Sem SKU',
        products: [],
        identifiers: [],
        availableCount: 0,
        editUrl: product.editUrl,
        publicUrl: product.publicUrl,
        stockLocationUrl: product.stockLocationUrl,
      };
      groups.set(key, group);
    }
    group.products.push(product);
    const identifier = productIdentifier(product);
    if (identifier) group.identifiers.push(identifier);
  }

  for (const fallbackGroup of colorGroup.fallbackSkuGroups || []) {
    const group = groups.get(fallbackGroup.key);
    if (group) {
      group.availableCount = fallbackGroup.availableCount;
      group.registeredCount = fallbackGroup.registeredCount;
      group.locationCount = fallbackGroup.locationCount;
      group.stockQuantityCount = fallbackGroup.stockQuantityCount;
      group.hasStockDivergence = fallbackGroup.hasStockDivergence;
      group.identifiers = fallbackGroup.identifiers;
    }
  }

  for (const group of groups.values()) {
    if (unitCountsBySku.has(group.key)) {
      group.availableCount = unitCountsBySku.get(group.key) || 0;
    }
    if (group.availableCount === 0) {
      group.availableCount = group.products.reduce((sum, product) => sum + Number(product.availableCount || 0), 0);
    }
    if (group.registeredCount == null) {
      group.registeredCount = group.identifiers.length;
    }
    if (group.locationCount == null) {
      const productIds = new Set(group.products.map((product) => String(product.id)));
      group.locationCount = dedupeLocations(
        (colorGroup.locations || []).filter((location) => productIds.has(String(location.productId || location.product_id || '')))
      ).reduce((sum, location) => sum + Number(location.quantity || 0), 0);
    }
    if (group.stockQuantityCount == null) {
      group.stockQuantityCount = group.products.reduce((sum, product) => sum + Number(product.availableCount || 0), 0);
    }
    if (group.hasStockDivergence == null) {
      group.hasStockDivergence = group.registeredCount > 0 && group.locationCount < group.registeredCount;
    }
    if (group.products.length > 1) {
      group.duplicateCount = group.products.length;
    }
  }

  return [...groups.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

function applyFallbackStockBySku(colorGroup) {
  const fallbackSources = colorGroup.fallbackSources || [];
  if (fallbackSources.length === 0) {
    colorGroup.locations = dedupeLocations(colorGroup.locations);
    colorGroup.skuGroups = buildSkuGroups(colorGroup);
    colorGroup.stockDivergences = colorGroup.skuGroups.filter((group) => group.hasStockDivergence);
    return;
  }

  const skuByProductId = new Map(colorGroup.products.map((product) => [String(product.id), skuKey(product)]));
  const serializedSkuKeys = new Set(
    (colorGroup.units || [])
      .map((unit) => skuByProductId.get(String(unit.productId || '')))
      .filter(Boolean)
  );

  const fallbackBySku = new Map();
  for (const source of fallbackSources) {
    const key = skuKey(source.product);
    if (serializedSkuKeys.has(key)) continue;
    let group = fallbackBySku.get(key);
    if (!group) {
      group = { key, products: [], locations: [] };
      fallbackBySku.set(key, group);
    }
    group.products.push(source.product);
    group.locations.push(...source.locations);
  }

  const fallbackSkuGroups = [];
  const divergences = [];
  for (const group of fallbackBySku.values()) {
    const dedupedLocations = dedupeLocations(group.locations);
    const locationQuantity = dedupedLocations.reduce((sum, location) => sum + Number(location.quantity || 0), 0);
    const registeredQuantity = group.products.filter((product) => isActiveProduct(product) && hasProductIdentifier(product)).length;
    const identifiers = group.products
      .map(productIdentifier)
      .filter(Boolean);
    const stockQuantity = group.products.reduce((sum, product) => sum + Number(product.availableCount || 0), 0);
    const maxProductQuantity = Math.max(...group.products.map((product) => Number(product.availableCount || 0)), 0);
    const quantity = registeredQuantity > 0 ? registeredQuantity : (locationQuantity > 0 ? locationQuantity : maxProductQuantity);
    const representative = group.products.reduce((best, product) => (
      Number(product.availableCount || 0) > Number(best.availableCount || 0) ? product : best
    ), group.products[0]);
    const hasStockDivergence = registeredQuantity > 0 && locationQuantity < registeredQuantity;

    addAvailableFallback(colorGroup, quantity, representative.priceCost);
    const skuGroup = {
      key: group.key,
      sku: representative.sku || 'Sem SKU',
      availableCount: quantity,
      registeredCount: registeredQuantity,
      locationCount: locationQuantity,
      stockQuantityCount: stockQuantity,
      stockCostValue: quantity * representative.priceCost,
      products: group.products,
      identifiers,
      locations: dedupedLocations,
      hasStockDivergence,
    };
    fallbackSkuGroups.push(skuGroup);
    if (hasStockDivergence) divergences.push(skuGroup);
  }

  colorGroup.locations = dedupeLocations(colorGroup.locations);
  colorGroup.fallbackSkuGroups = fallbackSkuGroups;
  colorGroup.skuGroups = buildSkuGroups(colorGroup);
  colorGroup.stockDivergences = divergences;
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
  const saleStatsByProductId = buildSaleStatsByProduct(input.products || [], input.sales || [], input.saleItems || []);
  const serializedSaleInfoByUnitId = buildSerializedSaleInfoByUnitId(input.sales || [], input.saleItems || [], input.customers || []);

  for (const product of input.products || []) {
    const { ram, storage, color } = getProductVariationSpecs(product);
    const missingFields = [
      !ram ? 'ram' : '',
      !storage ? 'storage' : '',
      !color ? 'color' : '',
    ].filter(Boolean);
    const incompleteIdentity = normalizeKey(product.sku) || normalizeKey(product.id);
    const memoryKey = missingFields.length
      ? `incomplete|${normalizeKey(ram)}|${normalizeKey(storage)}|${incompleteIdentity}`
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
      availableCount: Number(product.stock_quantity || 0),
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
        fallbackSources: [],
        fallbackSkuGroups: [],
        skuGroups: [],
        stockDivergences: [],
        ...emptyTotals(),
      };
      memoryGroup.colors.push(colorGroup);
    }
    colorGroup.products.push(productView);
    const normalizedLocations = (locationsByProductId[String(product.id)] || []).map((location) => ({
      ...normalizeLocation(location),
      productId: String(product.id),
    }));
    const locationLabelById = new Map(
      normalizedLocations
        .map((location) => [String(location.location_id || location.id || ''), location.label])
        .filter(([id]) => id)
    );
    colorGroup.locations.push(...normalizedLocations);

    const productUnits = unitsByProductId.get(String(product.id)) || [];
    for (const unit of productUnits) {
      const status = String(unit.status || '').toLowerCase();
      const explicitReturn = saleReturnByUnitId[String(unit.id)];
      const saleInfo = serializedSaleInfoByUnitId.get(String(unit.id)) || {};
      const costValue = Number((status === 'sold' && saleInfo.unitCost > 0) ? saleInfo.unitCost : (unit.cost_price ?? product.price_cost ?? 0));
      const returnedValue = Number(explicitReturn ?? saleInfo.returnedValue ?? (status === 'sold' ? product.price_retail || 0 : 0));
      const returnedValueEstimated = explicitReturn == null && saleInfo.returnedValue == null && status === 'sold';
      const saleId = unit.sale_id || saleInfo.saleId || null;
      const orderId = unit.order_id || saleInfo.orderId || null;
      const unitView = {
        id: String(unit.id || ''),
        productId: String(product.id || ''),
        sku: product.sku || '',
        imei1: String(unit.imei_1 || unit.imei1 || ''),
        imei2: String(unit.imei_2 || unit.imei2 || ''),
        serial: String(unit.serial_number || unit.serial || ''),
        status,
        locationId: unit.location_id || null,
        depositId: unit.deposit_id || null,
        locationLabel: locationLabelById.get(String(unit.location_id || '')) || '',
        saleId,
        orderId,
        orderNumber: saleInfo.orderNumber || orderId || '',
        customerName: saleInfo.customerName || '',
        costValue,
        returnedValue,
        returnedValueEstimated,
        profitValue: status === 'sold' && returnedValue ? returnedValue - costValue : 0,
        saleUrl: saleUrl({ sale_id: saleId }),
        orderUrl: orderUrl({ order_id: orderId }),
        raw: unit,
      };
      colorGroup.units.push(unitView);
      addUnitToTotals(colorGroup, unitView);
    }

    const productSpecsUnit = productUnits.length === 0 ? productIdentifierUnit(productView) : null;
    if (productSpecsUnit) {
      colorGroup.units.push(productSpecsUnit);
      addUnitToTotals(colorGroup, productSpecsUnit);
    } else if (productUnits.length === 0) {
      colorGroup.fallbackSources.push({
        product: productView,
        locations: normalizedLocations,
      });
    }

    const saleStats = saleStatsByProductId.get(String(product.id));
    if (saleStats) {
      addSaleStatsFallback(colorGroup, saleStats);
    }
  }

  const memoryGroups = [...memoryGroupMap.values()]
    .map((memoryGroup) => {
      resetTotals(memoryGroup);
      memoryGroup.colors.forEach((colorGroup) => {
        applyFallbackStockBySku(colorGroup);
        applyAverageStockCost(colorGroup);
        addTotals(memoryGroup, colorGroup);
      });
      applyAverageStockCost(memoryGroup);
      return {
        ...memoryGroup,
        colors: memoryGroup.colors.sort((a, b) => a.color.localeCompare(b.color)),
      };
    })
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
  applyAverageStockCost(totals);

  return {
    model: input.model,
    totals,
    memoryGroups,
  };
}
