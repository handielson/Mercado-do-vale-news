'use strict';

// Detalhamento financeiro de vendas de marketplace (Shopee).
// Fonte dos valores: /api/v2/payment/get_escrow_detail (valores em reais na API).
// Saída sempre em centavos. O repasse (escrow_amount) é a referência oficial:
// tudo que não tiver campo próprio cai em "Frete e outros ajustes", então a
// conta sempre fecha com o valor que a Shopee repassa.

const SHOPEE_REVENUE_FIELDS = [
  { key: 'original_price', label: 'Preço dos produtos', sign: 1 },
  { key: 'seller_discount', label: 'Desconto do vendedor', sign: -1 },
  { key: 'voucher_from_seller', label: 'Cupom do vendedor', sign: -1 },
];

const SHOPEE_FEE_FIELDS = [
  { key: 'commission_fee', label: 'Comissão Shopee' },
  { key: 'service_fee', label: 'Taxa de serviço' },
  { key: 'seller_transaction_fee', label: 'Taxa de transação' },
  { key: 'seller_order_processing_fee', label: 'Taxa de processamento do pedido' },
  { key: 'order_ams_commission_fee', label: 'Comissão de afiliados' },
  { key: 'campaign_fee', label: 'Taxa de campanha' },
  { key: 'fbs_fee', label: 'Taxa de fulfillment' },
  { key: 'reverse_shipping_fee', label: 'Frete de devolução' },
];

const SHOPEE_FIELD_LABELS = {
  escrow_amount: 'Repasse ao vendedor',
  buyer_total_amount: 'Total pago pelo comprador',
  original_price: 'Preço original dos produtos',
  seller_discount: 'Desconto do vendedor',
  shopee_discount: 'Desconto subsidiado pela Shopee',
  voucher_from_seller: 'Cupom do vendedor',
  voucher_from_shopee: 'Cupom da Shopee',
  coins: 'Moedas Shopee usadas',
  buyer_paid_shipping_fee: 'Frete pago pelo comprador',
  buyer_transaction_fee: 'Taxa de transação do comprador',
  cross_border_tax: 'Imposto internacional',
  payment_promotion: 'Promoção de pagamento',
  commission_fee: 'Comissão Shopee',
  service_fee: 'Taxa de serviço',
  seller_transaction_fee: 'Taxa de transação do vendedor',
  seller_order_processing_fee: 'Taxa de processamento do pedido',
  seller_lost_compensation: 'Compensação por perda',
  seller_coin_cash_back: 'Cashback em moedas (vendedor)',
  escrow_tax: 'Imposto retido',
  final_shipping_fee: 'Frete final (vendedor)',
  actual_shipping_fee: 'Frete real cobrado pela transportadora',
  estimated_shipping_fee: 'Frete estimado',
  shopee_shipping_rebate: 'Subsídio de frete da Shopee',
  shipping_fee_discount_from_3pl: 'Desconto de frete da transportadora',
  seller_shipping_discount: 'Desconto de frete do vendedor',
  reverse_shipping_fee: 'Frete de devolução',
  seller_return_refund: 'Reembolso de devolução',
  drc_adjustable_refund: 'Reembolso ajustável',
  cost_of_goods_sold: 'Valor dos produtos (após descontos)',
  original_cost_of_goods_sold: 'Valor original dos produtos',
  original_shopee_discount: 'Desconto original da Shopee',
  order_ams_commission_fee: 'Comissão de afiliados',
  campaign_fee: 'Taxa de campanha',
  fbs_fee: 'Taxa de fulfillment',
  credit_card_promotion: 'Promoção de cartão',
  total_adjustment_amount: 'Ajustes da Shopee',
  order_seller_discount: 'Desconto do vendedor no pedido',
  net_commission_fee: 'Comissão líquida',
  net_service_fee: 'Taxa de serviço líquida',
};

function majorToCents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function hasNumber(source, key) {
  if (!source || source[key] === undefined || source[key] === null || source[key] === '') return false;
  return Number.isFinite(Number(source[key]));
}

function normalizeStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function collectShopeeRawFields(income) {
  return Object.keys(income || {})
    .filter((key) => !key.endsWith('_pri') && hasNumber(income, key) && majorToCents(income[key]) !== 0)
    .map((key) => ({ key, label: SHOPEE_FIELD_LABELS[key] || key, amount_cents: majorToCents(income[key]) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function summarizeCosts(costItems) {
  const items = Array.isArray(costItems) ? costItems : [];
  const missing = items.filter((item) => !(Number(item.unit_cost_cents) > 0)).length;
  const totalCents = items.reduce((sum, item) => sum + (Number(item.total_cost_cents) || 0), 0);
  return { total_cents: totalCents, complete: items.length > 0 && missing === 0, missing_count: missing, items };
}

/**
 * Monta o detalhamento a partir do retorno do escrow e dos custos já resolvidos.
 * Função pura para facilitar testes.
 */
function buildShopeeSaleFinancials({ escrowResponse, orderStatus, costItems = [], error = '' } = {}) {
  const status = normalizeStatus(orderStatus);
  const cost = summarizeCosts(costItems);
  const income = escrowResponse?.order_income || null;
  const isCancelled = /CANCEL|INVALID/.test(status);

  if (!income) {
    return {
      source: 'shopee_escrow',
      state: isCancelled ? 'cancelled' : 'unavailable',
      note: isCancelled
        ? 'Pedido cancelado: não há repasse da Shopee.'
        : (error || 'A Shopee ainda não informou os valores financeiros deste pedido.'),
      revenue_lines: [],
      fee_lines: [],
      payout_cents: null,
      cost,
      profit_cents: null,
      raw_fields: [],
    };
  }

  const revenueLines = SHOPEE_REVENUE_FIELDS
    .filter((field) => hasNumber(income, field.key) && majorToCents(income[field.key]) !== 0)
    .map((field) => ({
      key: field.key,
      label: field.label,
      amount_cents: field.sign * Math.abs(majorToCents(income[field.key])),
    }));
  const productRevenueCents = revenueLines.reduce((sum, line) => sum + line.amount_cents, 0);

  const feeLines = SHOPEE_FEE_FIELDS
    .filter((field) => hasNumber(income, field.key) && majorToCents(income[field.key]) !== 0)
    .map((field) => ({ key: field.key, label: field.label, amount_cents: -Math.abs(majorToCents(income[field.key])) }));

  const payoutCents = majorToCents(income.escrow_amount);
  const explainedCents = productRevenueCents + feeLines.reduce((sum, line) => sum + line.amount_cents, 0);
  const residualCents = payoutCents - explainedCents;
  if (residualCents !== 0) {
    feeLines.push({ key: 'other_adjustments', label: 'Frete e outros ajustes', amount_cents: residualCents });
  }

  const marketplaceDeductionsCents = productRevenueCents - payoutCents;
  const profitCents = payoutCents - cost.total_cents;
  const isFinal = status === 'COMPLETED';

  return {
    source: 'shopee_escrow',
    state: isCancelled && payoutCents === 0 ? 'cancelled' : (isFinal ? 'final' : 'estimated'),
    note: isCancelled && payoutCents === 0
      ? 'Pedido cancelado: não há repasse da Shopee.'
      : (isFinal
        ? 'Valores finais do repasse informados pela Shopee.'
        : 'Valores estimados pela Shopee; podem mudar até a conclusão do pedido.'),
    product_revenue_cents: productRevenueCents,
    buyer_paid_cents: hasNumber(income, 'buyer_total_amount') ? majorToCents(income.buyer_total_amount) : null,
    revenue_lines: revenueLines,
    fee_lines: feeLines,
    marketplace_deductions_cents: marketplaceDeductionsCents,
    marketplace_deductions_pct: productRevenueCents > 0 ? (marketplaceDeductionsCents / productRevenueCents) * 100 : null,
    payout_cents: payoutCents,
    cost,
    profit_cents: profitCents,
    margin_pct: productRevenueCents > 0 ? (profitCents / productRevenueCents) * 100 : null,
    raw_fields: collectShopeeRawFields(income),
  };
}

function cleanText(value) {
  return String(value ?? '').trim();
}

/** Itens do escrow (preferidos, trazem item_id/model_id) com fallback nos itens do pedido. */
function shopeeCostLookupItems(escrowResponse, saleItems = []) {
  const escrowItems = Array.isArray(escrowResponse?.order_income?.items) ? escrowResponse.order_income.items : [];
  if (escrowItems.length) {
    return escrowItems.map((item) => ({
      name: cleanText(item.item_name) || 'Item',
      variation: cleanText(item.model_name),
      sku: cleanText(item.model_sku) || cleanText(item.item_sku),
      item_id: cleanText(item.item_id),
      model_id: cleanText(item.model_id),
      quantity: Math.max(1, Number(item.quantity_purchased) || 1),
    }));
  }
  return (Array.isArray(saleItems) ? saleItems : []).map((item) => ({
    name: cleanText(item.name) || 'Item',
    variation: cleanText(item.variation),
    sku: cleanText(item.sku),
    item_id: cleanText(item.marketplace_item_id),
    model_id: cleanText(item.marketplace_model_id),
    quantity: Math.max(1, Number(item.quantity) || 1),
  }));
}

async function resolveShopeeItemCosts(pool, connectionId, lookupItems) {
  const items = Array.isArray(lookupItems) ? lookupItems : [];
  const itemIds = [...new Set(items.map((item) => item.item_id).filter(Boolean))];
  const links = [];
  if (itemIds.length) {
    const [rows] = await pool.query(
      `SELECT product_id, shopee_item_id, shopee_model_id
         FROM shopee_products
        WHERE connection_id = ?
          AND shopee_item_id IN (${itemIds.map(() => '?').join(',')})`,
      [connectionId || 'primary', ...itemIds],
    );
    links.push(...(Array.isArray(rows) ? rows : []));
  }

  const linkedProductIdFor = (item) => {
    if (!item.item_id) return '';
    const sameItem = links.filter((row) => cleanText(row.shopee_item_id) === item.item_id);
    const hasModel = item.model_id && item.model_id !== '0';
    const exact = hasModel ? sameItem.find((row) => cleanText(row.shopee_model_id) === item.model_id) : null;
    if (exact) return cleanText(exact.product_id);
    const plain = sameItem.filter((row) => !row.shopee_model_id || cleanText(row.shopee_model_id) === '0');
    if (!hasModel && plain.length === 1) return cleanText(plain[0].product_id);
    return '';
  };

  const linkedIds = items.map(linkedProductIdFor);
  const productIds = [...new Set(linkedIds.filter(Boolean))];
  const skus = [...new Set(items.filter((item, index) => !linkedIds[index] && item.sku).map((item) => item.sku))];
  const products = [];
  if (productIds.length || skus.length) {
    const clauses = [];
    const params = [];
    if (productIds.length) { clauses.push(`id IN (${productIds.map(() => '?').join(',')})`); params.push(...productIds); }
    if (skus.length) { clauses.push(`sku IN (${skus.map(() => '?').join(',')})`); params.push(...skus); }
    const [rows] = await pool.query(
      `SELECT id, name, sku, price_cost FROM products WHERE ${clauses.join(' OR ')}`,
      params,
    );
    products.push(...(Array.isArray(rows) ? rows : []));
  }
  const byId = new Map(products.map((product) => [cleanText(product.id), product]));

  return items.map((item, index) => {
    let product = linkedIds[index] ? byId.get(linkedIds[index]) : null;
    let matchedBy = product ? 'shopee_link' : null;
    if (!product && item.sku) {
      const bySku = products.filter((candidate) => cleanText(candidate.sku).toLowerCase() === item.sku.toLowerCase());
      if (bySku.length === 1) { product = bySku[0]; matchedBy = 'sku'; }
    }
    const unitCostCents = product ? Math.max(0, Math.round(Number(product.price_cost) || 0)) : 0;
    return {
      name: item.name,
      variation: item.variation || '',
      sku: item.sku || '',
      quantity: item.quantity,
      product_id: product ? cleanText(product.id) : null,
      product_name: product ? cleanText(product.name) : null,
      matched_by: matchedBy,
      unit_cost_cents: unitCostCents,
      total_cost_cents: unitCostCents * item.quantity,
    };
  });
}

/**
 * fetchEscrow(orderSn, connectionId) deve devolver o JSON bruto da Shopee
 * ({ response: { order_income } } ou { error, message }).
 */
function createShopeeSaleFinancialsLoader({ pool, fetchEscrow }) {
  return async function loadShopeeSaleFinancials(sale, connectionId = 'primary') {
    const orderSn = cleanText(sale?.external_id);
    if (!orderSn) return null;
    let escrowResponse = null;
    let error = '';
    try {
      const data = await fetchEscrow(orderSn, connectionId);
      if (data?.error) error = cleanText(data.message || data.error);
      else escrowResponse = data?.response || null;
    } catch (fetchError) {
      error = cleanText(fetchError?.message || fetchError) || 'Falha ao consultar o repasse na Shopee.';
    }
    const lookupItems = shopeeCostLookupItems(escrowResponse, sale?.details?.items);
    let costItems = [];
    try {
      costItems = await resolveShopeeItemCosts(pool, connectionId, lookupItems);
    } catch (costError) {
      console.error('[marketplace-sale-financials] cost lookup failed:', costError?.message || costError);
      costItems = lookupItems.map((item) => ({ ...item, product_id: null, product_name: null, matched_by: null, unit_cost_cents: 0, total_cost_cents: 0 }));
    }
    return buildShopeeSaleFinancials({ escrowResponse, orderStatus: sale?.status, costItems, error });
  };
}

module.exports = {
  buildShopeeSaleFinancials,
  shopeeCostLookupItems,
  resolveShopeeItemCosts,
  createShopeeSaleFinancialsLoader,
  SHOPEE_FIELD_LABELS,
};
