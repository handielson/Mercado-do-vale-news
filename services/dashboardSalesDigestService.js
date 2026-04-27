function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function parseLocalDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

export function isSameLocalDay(value, now = new Date()) {
  const parsed = parseLocalDate(value);
  if (!isValidDate(parsed) || !isValidDate(now)) return false;
  return parsed.getFullYear() === now.getFullYear()
    && parsed.getMonth() === now.getMonth()
    && parsed.getDate() === now.getDate();
}

function normalizeText(value, fallback = 'Sem identificacao') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeSku(value) {
  return String(value || '').trim().toUpperCase();
}

function formatLocalDateKey(value) {
  const parsed = parseLocalDate(value);
  if (!isValidDate(parsed)) return '';
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function toCentsFromMajorUnits(value) {
  const numeric = Number(value) || 0;
  return Math.round(numeric * 100);
}

function buildCatalogMaps(productCatalog = []) {
  const byId = new Map();
  const bySku = new Map();

  for (const product of productCatalog) {
    const normalized = {
      id: product?.id || '',
      sku: normalizeSku(product?.sku),
      name: normalizeText(product?.name, 'Produto'),
      stock_quantity: Number(product?.stock_quantity) || 0,
      price_cost: Number(product?.price_cost) || 0,
      price_retail: Number(product?.price_retail) || 0,
    };

    if (normalized.id) byId.set(normalized.id, normalized);
    if (normalized.sku) bySku.set(normalized.sku, normalized);
  }

  return { byId, bySku };
}

function enrichWithCatalog(baseRow, catalogMaps) {
  const product = (baseRow.productId && catalogMaps.byId.get(baseRow.productId))
    || (baseRow.sku && catalogMaps.bySku.get(baseRow.sku))
    || null;

  return {
    ...baseRow,
    model: normalizeText(baseRow.model, product?.name || 'Produto'),
    sku: normalizeSku(baseRow.sku),
    currentStock: Number(product?.stock_quantity) || 0,
    lastPurchasePriceCents: Number(product?.price_cost) || 0,
    lastSalePriceCents: Number(product?.price_retail) || 0,
  };
}

function normalizePdvRows(pdvSales = [], now = new Date()) {
  const rows = [];

  for (const sale of pdvSales) {
    if (sale?.status && sale.status !== 'completed') continue;

    const createdAt = new Date(sale.created_at);
    const items = Array.isArray(sale?.items) ? sale.items : [];

    for (const item of items) {
      const quantity = Number(item?.quantity) || 0;
      if (quantity <= 0) continue;

      rows.push({
        channel: 'PDV',
        channelKey: 'pdv',
        originLabel: 'PDV',
        saleId: sale?.id || '',
        timestamp: createdAt.getTime(),
        date: sale?.created_at || createdAt.toISOString(),
        model: item?.product_model || item?.product_name,
        sku: item?.product_sku,
        quantity,
        revenueCents: Number(item?.total) || ((Number(item?.unit_price) || 0) * quantity),
        productId: item?.product_id || '',
      });
    }
  }

  return rows;
}

function normalizeShopeeRows(shopeeOrders = [], now = new Date()) {
  const rows = [];
  const blockedStatuses = new Set(['CANCELLED', 'IN_CANCEL', 'TO_RETURN', 'IN_RETURN', 'REFUNDED']);

  for (const order of shopeeOrders) {
    const createdAt = new Date((Number(order?.create_time) || 0) * 1000);
    if (blockedStatuses.has(String(order?.order_status || '').toUpperCase())) continue;

    const items = Array.isArray(order?.item_list) ? order.item_list : [];
    for (const item of items) {
      const quantity = Number(
        item?.model_quantity_purchased
        ?? item?.item_quantity
        ?? item?.quantity
        ?? 0,
      ) || 0;
      if (quantity <= 0) continue;

      const totalValueMajor = Number(
        item?.model_discounted_price
        ?? item?.item_price
        ?? item?.model_original_price
        ?? item?.original_price
        ?? 0,
      ) || 0;

      rows.push({
        channel: 'Shopee',
        channelKey: 'shopee',
        originLabel: 'Shopee',
        saleId: order?.order_sn || '',
        timestamp: createdAt.getTime(),
        date: createdAt.toISOString(),
        model: item?.model_name || item?.item_name,
        sku: item?.model_sku || item?.item_sku,
        quantity,
        revenueCents: toCentsFromMajorUnits(totalValueMajor) * quantity,
        productId: item?.item_id ? String(item.item_id) : '',
      });
    }
  }

  return rows;
}

function normalizeBlingRows(blingInvoices = [], now = new Date()) {
  const rows = [];

  for (const invoice of blingInvoices) {
    const invoiceDate = parseLocalDate(invoice.dataEmissao);
    const items = Array.isArray(invoice?.items) ? invoice.items : [];

    for (const item of items) {
      const quantity = Number(item?.quantidade ?? item?.quantity ?? item?.qtd ?? 0) || 0;
      if (quantity <= 0) continue;

      const totalMajor = Number(
        item?.valorTotal
        ?? item?.total
        ?? (
          (Number(item?.valor ?? item?.valorUnitario ?? 0) || 0)
          * quantity
        )
        ?? 0,
      ) || 0;

      rows.push({
        channel: 'Bling',
        channelKey: 'bling',
        originLabel: normalizeText(invoice?.origem || invoice?.canal || 'Bling', 'Bling'),
        saleId: `${invoice?.tipo || 'nf'}-${invoice?.id || invoice?.numero || ''}`,
        timestamp: invoiceDate.getTime(),
        date: invoiceDate.toISOString(),
        model: item?.descricao || item?.nome,
        sku: item?.codigo || item?.sku,
        quantity,
        revenueCents: toCentsFromMajorUnits(totalMajor),
        productId: item?.product_id ? String(item.product_id) : '',
      });
    }
  }

  return rows;
}

export function buildDashboardSalesDigest({
  pdvSales = [],
  shopeeOrders = [],
  blingInvoices = [],
  productCatalog = [],
  now = new Date(),
}) {
  const catalogMaps = buildCatalogMaps(productCatalog);
  const allRows = [
    ...normalizePdvRows(pdvSales, now),
    ...normalizeShopeeRows(shopeeOrders, now),
    ...normalizeBlingRows(blingInvoices, now),
  ]
    .map((row) => enrichWithCatalog(row, catalogMaps))
    .sort((a, b) => b.timestamp - a.timestamp || a.model.localeCompare(b.model, 'pt-BR'));

  const todayKey = formatLocalDateKey(now);
  const hasTodayRows = allRows.some((row) => formatLocalDateKey(row.date) === todayKey);
  const latestRow = allRows[0];
  const referenceDate = hasTodayRows
    ? todayKey
    : (latestRow ? formatLocalDateKey(latestRow.date) : todayKey);
  const periodMode = hasTodayRows || !latestRow ? 'today' : 'latest';

  const detailedRows = allRows.filter((row) => formatLocalDateKey(row.date) === referenceDate);

  const summaryMap = new Map();

  for (const row of detailedRows) {
    const summaryKey = `${row.model}::${row.sku || 'SEM-SKU'}`;
    const existing = summaryMap.get(summaryKey);

    if (!existing) {
      summaryMap.set(summaryKey, {
        model: row.model,
        sku: row.sku,
        totalQuantity: row.quantity,
        currentStock: row.currentStock,
        lastPurchasePriceCents: row.lastPurchasePriceCents,
        lastSalePriceCents: row.lastSalePriceCents,
        channels: [row.channel],
        latestTimestamp: row.timestamp,
      });
      continue;
    }

    existing.totalQuantity += row.quantity;
    existing.currentStock = row.currentStock;
    existing.lastPurchasePriceCents = row.lastPurchasePriceCents;
    existing.lastSalePriceCents = row.lastSalePriceCents;
    existing.latestTimestamp = Math.max(existing.latestTimestamp, row.timestamp);
    if (!existing.channels.includes(row.channel)) existing.channels.push(row.channel);
  }

  const summaryRows = Array.from(summaryMap.values())
    .sort((a, b) => b.latestTimestamp - a.latestTimestamp || a.model.localeCompare(b.model, 'pt-BR'))
    .map((row) => ({
      ...row,
      channels: row.channels.join(' + '),
    }));

  return {
    detailedRows,
    summaryRows,
    referenceDate,
    periodMode,
    totals: {
      lines: detailedRows.length,
      quantity: detailedRows.reduce((acc, row) => acc + row.quantity, 0),
      revenueCents: detailedRows.reduce((acc, row) => acc + row.revenueCents, 0),
    },
  };
}

async function fetchJsonOrThrow(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }

  return payload;
}

async function fetchShopeeDetailedOrders(now) {
  const start = new Date(now);
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);
  const timeFrom = Math.floor(start.getTime() / 1000);
  const timeTo = Math.floor(now.getTime() / 1000);
  const statuses = ['READY_TO_SHIP', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'TO_CONFIRM_RECEIVE'];
  const basicOrders = [];

  for (const status of statuses) {
    const payload = await fetchJsonOrThrow(
      `/api/shopee-actions?action=get_order_list&time_from=${timeFrom}&time_to=${timeTo}&page_size=100&order_status=${status}`,
    );
    const orderList = Array.isArray(payload?.response?.order_list) ? payload.response.order_list : [];

    for (const order of orderList) {
      basicOrders.push({
        order_sn: order?.order_sn,
        create_time: order?.create_time,
        order_status: order?.order_status || status,
      });
    }
  }

  const uniqueOrders = Array.from(new Map(
    basicOrders
      .filter((order) => order?.order_sn)
      .map((order) => [order.order_sn, order]),
  ).values());

  const detailedOrders = [];
  const batchSize = 20;
  for (let index = 0; index < uniqueOrders.length; index += batchSize) {
    const batch = uniqueOrders.slice(index, index + batchSize);
    const orderSnList = batch.map((order) => order.order_sn).join(',');
    if (!orderSnList) continue;

    const payload = await fetchJsonOrThrow(`/api/shopee-actions?action=get_order_detail&order_sn_list=${orderSnList}`);
    const detailList = Array.isArray(payload?.response?.order_list) ? payload.response.order_list : [];

    for (const detail of detailList) {
      const base = batch.find((order) => order.order_sn === detail?.order_sn);
      detailedOrders.push({
        ...base,
        ...detail,
      });
    }
  }

  return detailedOrders;
}

async function loadPdvSales(now) {
  const { supabase } = await import('./supabase');
  const start = new Date(now);
  start.setDate(start.getDate() - 14);
  start.setHours(0, 0, 0, 0);

  let response = await supabase
    .from('sales')
    .select('id, created_at, status, items:sale_items(product_id, product_name, product_model, product_sku, quantity, total, unit_price, unit_cost)')
    .gte('created_at', start.toISOString())
    .lte('created_at', now.toISOString());

  if (response.error?.code === '42703') {
    response = await supabase
      .from('sales')
      .select('id, created_at, status, items:sale_items(product_id, product_name, quantity, total, unit_price, unit_cost)')
      .gte('created_at', start.toISOString())
      .lte('created_at', now.toISOString());
  }

  if (response.error) throw response.error;
  return Array.isArray(response.data) ? response.data : [];
}

async function loadProductCatalog() {
  const { supabase } = await import('./supabase');
  const response = await supabase
    .from('products')
    .select('id, sku, name, stock_quantity, price_cost, price_retail');

  if (response.error) throw response.error;
  return Array.isArray(response.data) ? response.data : [];
}

function extractBlingDetailItems(detailPayload) {
  const data = detailPayload?.data || detailPayload || {};
  const candidates = [
    data?.itens,
    data?.itensNota,
    data?.produtos,
    data?.itensProdutos,
  ];
  const rawItems = candidates.find((candidate) => Array.isArray(candidate)) || [];

  return rawItems.map((entry) => {
    const item = entry?.item || entry?.produto || entry;
    return {
      descricao: item?.descricao || item?.nome || item?.produto || item?.descricaoProduto,
      codigo: item?.codigo || item?.sku || item?.codigoProduto || item?.codigoItem,
      quantidade: item?.quantidade || item?.qtd || item?.qtde || 0,
      valorTotal: item?.valorTotal || item?.total || (
        (Number(item?.valor || item?.valorUnitario || 0) || 0)
        * (Number(item?.quantidade || item?.qtd || item?.qtde || 0) || 0)
      ),
    };
  });
}

async function fetchBlingDetailedInvoices(now) {
  const start = new Date(now);
  start.setDate(start.getDate() - 14);
  const dateStart = start.toISOString().split('T')[0];
  const dateEnd = now.toISOString().split('T')[0];
  const invoices = [];

  for (const tipo of ['nfe', 'nfce']) {
    const listPayload = await fetchJsonOrThrow(`/api/bling?resource=${tipo}&dataEmissaoInicio=${dateStart}&dataEmissaoFim=${dateEnd}&situacao=2`);
    const items = Array.isArray(listPayload?.data) ? listPayload.data : [];

    for (const invoice of items) {
      const detailPayload = await fetchJsonOrThrow(`/api/bling?resource=nf-detail&tipo=${tipo}&id=${invoice.id}`);
      invoices.push({
        id: invoice?.id,
        numero: String(invoice?.numero || ''),
        tipo,
        dataEmissao: String(invoice?.dataEmissao || '').substring(0, 10),
        contato: invoice?.contato ? { nome: invoice.contato.nome } : undefined,
        origem: detailPayload?.data?.loja?.descricao || detailPayload?.data?.origem || 'Bling',
        items: extractBlingDetailItems(detailPayload),
      });
    }
  }

  return invoices;
}

export async function getDashboardSalesDigest(now = new Date()) {
  const settled = await Promise.allSettled([
    loadPdvSales(now),
    loadProductCatalog(),
    fetchShopeeDetailedOrders(now),
    fetchBlingDetailedInvoices(now),
  ]);

  const warnings = [];
  const [pdvResult, catalogResult, shopeeResult, blingResult] = settled;

  if (pdvResult.status === 'rejected') warnings.push('PDV indisponivel no momento.');
  if (catalogResult.status === 'rejected') warnings.push('Catalogo de produtos indisponivel no momento.');
  if (shopeeResult.status === 'rejected') warnings.push('Shopee indisponivel no momento.');
  if (blingResult.status === 'rejected') warnings.push('Bling indisponivel no momento.');

  const digest = buildDashboardSalesDigest({
    pdvSales: pdvResult.status === 'fulfilled' ? pdvResult.value : [],
    productCatalog: catalogResult.status === 'fulfilled' ? catalogResult.value : [],
    shopeeOrders: shopeeResult.status === 'fulfilled' ? shopeeResult.value : [],
    blingInvoices: blingResult.status === 'fulfilled' ? blingResult.value : [],
    now,
  });

  return {
    ...digest,
    warnings,
  };
}
