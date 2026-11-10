'use strict';

const { manualCostLockReason, costBasisOf } = require('./productManualCost.cjs');

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
    for (const row of Array.isArray(rows) ? rows : []) {
      links.push({ product_id: row.product_id, item_id: row.shopee_item_id, model_id: row.shopee_model_id });
    }
  }
  return resolveItemCostsFromLinks(pool, items, links, 'shopee_link');
}

/**
 * Custo dos itens a partir do vínculo do anúncio (links normalizados em {product_id, item_id, model_id})
 * com fallback por SKU único. Mesma fonte de custo para todos os marketplaces: products.price_cost.
 */
async function resolveItemCostsFromLinks(pool, items, links, linkMatchLabel) {
  const linkedProductIdFor = (item) => {
    if (!item.item_id) return '';
    const sameItem = links.filter((row) => cleanText(row.item_id) === item.item_id);
    const hasModel = item.model_id && item.model_id !== '0';
    const exact = hasModel ? sameItem.find((row) => cleanText(row.model_id) === item.model_id) : null;
    if (exact) return cleanText(exact.product_id);
    const plain = sameItem.filter((row) => !row.model_id || cleanText(row.model_id) === '0');
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
      `SELECT id, name, sku, price_cost, is_parent, specs, custom_fields FROM products WHERE ${clauses.join(' OR ')}`,
      params,
    );
    products.push(...(Array.isArray(rows) ? rows : []));
  }
  const byId = new Map(products.map((product) => [cleanText(product.id), product]));
  const unitCounts = new Map();
  if (products.length) {
    const ids = products.map((product) => cleanText(product.id));
    const [rows] = await pool.query(
      `SELECT product_id, COUNT(*) AS total FROM units WHERE product_id IN (${ids.map(() => '?').join(',')}) GROUP BY product_id`,
      ids,
    );
    for (const row of Array.isArray(rows) ? rows : []) unitCounts.set(cleanText(row.product_id), Number(row.total) || 0);
  }

  return items.map((item, index) => {
    let product = linkedIds[index] ? byId.get(linkedIds[index]) : null;
    let matchedBy = product ? linkMatchLabel : null;
    if (!product && item.sku) {
      const bySku = products.filter((candidate) => cleanText(candidate.sku).toLowerCase() === item.sku.toLowerCase());
      if (bySku.length === 1) { product = bySku[0]; matchedBy = 'sku'; }
    }
    const unitCostCents = product ? Math.max(0, Math.round(Number(product.price_cost) || 0)) : 0;
    const lockReason = product ? manualCostLockReason(product, unitCounts.get(cleanText(product.id)) || 0) : null;
    return {
      name: item.name,
      variation: item.variation || '',
      sku: item.sku || '',
      quantity: item.quantity,
      product_id: product ? cleanText(product.id) : null,
      product_name: product ? cleanText(product.name) : null,
      matched_by: matchedBy,
      current_cost_cents: product && product.price_cost !== null && product.price_cost !== undefined ? Math.round(Number(product.price_cost)) : null,
      cost_basis: product ? costBasisOf(product) : null,
      cost_editable: Boolean(product) && !lockReason,
      cost_lock_reason: lockReason,
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

// ---------------------------------------------------------------------------
// marketplace-sale-financials-ml-tiktok-v1: Mercado Livre e TikTok Shop.
// Mesmo contrato do resumo da Shopee (centavos), com:
// - origin: 'marketplace' (valores reais da API) — quando a API não informa, state = 'unavailable'
//   e estimate_basis traz os itens (preço e custo) para a tela estimar pelas taxas configuradas
//   por canal (utils/channelProfit.js, mesma tabela da Página do Produto);
// - payout_label: rótulo do valor recebido do marketplace.
// Custo: mesma fonte do resumo da Shopee (products.price_cost via vínculo do anúncio ou SKU único).
// ---------------------------------------------------------------------------

const TIKTOK_SCOPE_ERROR_CODE = 105005;

function safeAmountCents(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > 1_000_000_000) return null;
  return Math.round(number * 100);
}

function sumCents(values) {
  return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function buildEstimateBasis(channelFeeId, lookupItems, costItems, reason) {
  const items = (Array.isArray(lookupItems) ? lookupItems : []).map((item, index) => ({
    name: item.name,
    quantity: item.quantity,
    unit_price_cents: Math.max(0, Math.round(Number(item.unit_price_cents) || 0)),
    unit_cost_cents: Math.max(0, Math.round(Number(costItems?.[index]?.unit_cost_cents) || 0)),
  }));
  return { channel_fee_id: channelFeeId, reason: cleanText(reason), items };
}

function unavailableChannelFinancials({ source, payoutLabel, channelFeeId, lookupItems, costItems, reason, cancelled }) {
  const cost = summarizeCosts(costItems);
  const productRevenueCents = sumCents((lookupItems || []).map((item) => (Number(item.unit_price_cents) || 0) * item.quantity));
  return {
    source,
    origin: 'marketplace',
    state: cancelled ? 'cancelled' : 'unavailable',
    note: cleanText(reason),
    payout_label: payoutLabel,
    product_revenue_cents: productRevenueCents,
    buyer_paid_cents: null,
    revenue_lines: [],
    fee_lines: [],
    payout_cents: null,
    cost,
    profit_cents: null,
    margin_pct: null,
    raw_fields: [],
    estimate_basis: cancelled ? null : buildEstimateBasis(channelFeeId, lookupItems, costItems, reason),
  };
}

function finishChannelFinancials({ source, payoutLabel, state, note, revenueLines, feeLines, payoutCents, buyerPaidCents, costItems, rawFields }) {
  const cost = summarizeCosts(costItems);
  const productRevenueCents = sumCents(revenueLines.map((line) => line.amount_cents));
  const marketplaceDeductionsCents = productRevenueCents - payoutCents;
  const profitCents = payoutCents - cost.total_cents;
  return {
    source,
    origin: 'marketplace',
    state,
    note,
    payout_label: payoutLabel,
    product_revenue_cents: productRevenueCents,
    buyer_paid_cents: buyerPaidCents,
    revenue_lines: revenueLines,
    fee_lines: feeLines,
    marketplace_deductions_cents: marketplaceDeductionsCents,
    marketplace_deductions_pct: productRevenueCents > 0 ? (marketplaceDeductionsCents / productRevenueCents) * 100 : null,
    payout_cents: payoutCents,
    cost,
    profit_cents: profitCents,
    margin_pct: productRevenueCents > 0 ? (profitCents / productRevenueCents) * 100 : null,
    raw_fields: rawFields.filter((field) => field.amount_cents !== 0),
    estimate_basis: null,
  };
}

// --- Mercado Livre --------------------------------------------------------

/** Itens do pedido bruto do ML (GET /orders/{id}); fallback nos itens já normalizados da venda. */
function mercadoLivreCostLookupItems(order, saleItems = []) {
  const orderItems = Array.isArray(order?.order_items) ? order.order_items : [];
  if (orderItems.length) {
    return orderItems.map((entry) => ({
      name: cleanText(entry?.item?.title) || 'Item Mercado Livre',
      variation: cleanText(entry?.item?.variation_id),
      sku: cleanText(entry?.item?.seller_sku) || cleanText(entry?.item?.seller_custom_field),
      item_id: cleanText(entry?.item?.id).toUpperCase(),
      model_id: cleanText(entry?.item?.variation_id),
      quantity: Math.max(1, Number(entry?.quantity) || 1),
      unit_price_cents: Math.max(0, safeAmountCents(entry?.unit_price) || 0),
    }));
  }
  return (Array.isArray(saleItems) ? saleItems : []).map((item) => ({
    name: cleanText(item.name) || 'Item Mercado Livre',
    variation: cleanText(item.variation),
    sku: cleanText(item.sku),
    item_id: '',
    model_id: '',
    quantity: Math.max(1, Number(item.quantity) || 1),
    unit_price_cents: Math.max(0, Math.round(Number(item.unit_price_cents) || 0)),
  }));
}

function mercadoLivreSellerShippingCents(shipmentCosts, sellerId) {
  const senders = Array.isArray(shipmentCosts?.senders) ? shipmentCosts.senders : [];
  if (!senders.length) return null;
  const sender = senders.find((row) => sellerId && cleanText(row?.user_id) === cleanText(sellerId)) || (senders.length === 1 ? senders[0] : null);
  if (!sender) return null;
  const costCents = safeAmountCents(sender.cost);
  return costCents === null ? null : Math.abs(costCents);
}

/**
 * Função pura. order = GET /orders/{id}; shipmentCosts = GET /shipments/{id}/costs (ou null).
 * Tarifa de venda: order_items[].sale_fee (por unidade) × quantidade; se ausente, payments[].marketplace_fee.
 * Frete do vendedor: senders[].cost do custo do envio. Impostos: payments[].taxes_amount.
 */
function buildMercadoLivreSaleFinancials({ order, shipmentCosts = null, shipmentCostsError = '', costItems = [], saleItems = [], error = '' } = {}) {
  const lookupItems = mercadoLivreCostLookupItems(order, saleItems);
  const common = { source: 'mercado_livre_order', payoutLabel: 'Valor recebido do Mercado Livre', channelFeeId: 'mercado_livre', lookupItems, costItems };
  if (!order || !Array.isArray(order.order_items) || !order.order_items.length) {
    return unavailableChannelFinancials({ ...common, reason: error || 'Não foi possível consultar as tarifas deste pedido no Mercado Livre.' });
  }
  const status = normalizeStatus(order.status);
  if (/CANCEL|INVALID/.test(status)) {
    return unavailableChannelFinancials({ ...common, cancelled: true, reason: 'Pedido cancelado: não há valor a receber do Mercado Livre.' });
  }

  const payments = (Array.isArray(order.payments) ? order.payments : []).filter((payment) => !/REJECT|CANCEL|REFUND/i.test(cleanText(payment?.status)));
  const itemFees = order.order_items.map((entry) => safeAmountCents(entry?.sale_fee));
  const saleFeeFromItems = itemFees.every((fee) => fee !== null)
    ? sumCents(order.order_items.map((entry, index) => Math.abs(itemFees[index]) * Math.max(1, Number(entry?.quantity) || 1)))
    : null;
  const paymentFees = payments.map((payment) => safeAmountCents(payment?.marketplace_fee)).filter((fee) => fee !== null);
  const saleFeeFromPayments = paymentFees.length ? Math.abs(sumCents(paymentFees)) : null;
  const saleFeeCents = saleFeeFromItems ?? saleFeeFromPayments;
  if (saleFeeCents === null) {
    return unavailableChannelFinancials({ ...common, reason: 'O Mercado Livre ainda não informou a tarifa de venda deste pedido.' });
  }

  const sellerId = cleanText(order?.seller?.id);
  const hasShipment = Boolean(cleanText(order?.shipping?.id));
  const sellerShippingCents = hasShipment ? mercadoLivreSellerShippingCents(shipmentCosts, sellerId) : 0;
  const taxesCents = Math.abs(sumCents(payments.map((payment) => safeAmountCents(payment?.taxes_amount) || 0)));

  const revenueLines = [{ key: 'items', label: 'Preço dos produtos', amount_cents: sumCents(lookupItems.map((item) => item.unit_price_cents * item.quantity)) }];
  const feeLines = [{ key: 'sale_fee', label: 'Tarifa de venda do Mercado Livre', amount_cents: -saleFeeCents }];
  if (sellerShippingCents) feeLines.push({ key: 'seller_shipping', label: 'Frete pago pelo vendedor', amount_cents: -sellerShippingCents });
  if (taxesCents) feeLines.push({ key: 'taxes', label: 'Impostos informados no pagamento', amount_cents: -taxesCents });
  const payoutCents = revenueLines[0].amount_cents + sumCents(feeLines.map((line) => line.amount_cents));

  const paidValues = payments.map((payment) => safeAmountCents(payment?.total_paid_amount)).filter((value) => value !== null);
  const buyerPaidCents = paidValues.length ? sumCents(paidValues) : null;
  const tags = Array.isArray(order.tags) ? order.tags.map((tag) => cleanText(tag).toLowerCase()) : [];
  const delivered = tags.includes('delivered');
  const notes = [delivered
    ? 'Valores informados pelo Mercado Livre (pedido entregue).'
    : 'Valores informados pelo Mercado Livre; podem mudar até a entrega (ex.: devolução ou ajuste de frete).'];
  if (hasShipment && sellerShippingCents === null) {
    notes.push(`Frete do vendedor não informado${shipmentCostsError ? ` (${cleanText(shipmentCostsError).slice(0, 120)})` : ''}; o valor recebido pode ser menor.`);
  }
  if (cleanText(order.pack_id) && sellerShippingCents) notes.push('Pedido de carrinho: o frete é do envio inteiro, compartilhado com os outros pedidos do carrinho.');

  const rawFields = [
    { key: 'sale_fee_items', label: 'Tarifa de venda (order_items.sale_fee × qtd.)', amount_cents: saleFeeFromItems || 0 },
    { key: 'marketplace_fee', label: 'Tarifa do marketplace (pagamentos)', amount_cents: saleFeeFromPayments || 0 },
    { key: 'buyer_shipping', label: 'Frete pago pelo comprador', amount_cents: sumCents(payments.map((payment) => safeAmountCents(payment?.shipping_cost) || 0)) },
    { key: 'taxes_amount', label: 'Impostos (pagamentos)', amount_cents: taxesCents },
    { key: 'sender_cost', label: 'Custo do envio para o vendedor', amount_cents: sellerShippingCents || 0 },
    { key: 'receiver_cost', label: 'Custo do envio para o comprador', amount_cents: safeAmountCents(shipmentCosts?.receiver?.cost) || 0 },
    { key: 'total_paid_amount', label: 'Total pago pelo comprador', amount_cents: buyerPaidCents || 0 },
  ];

  return finishChannelFinancials({
    source: 'mercado_livre_order',
    payoutLabel: 'Valor recebido do Mercado Livre',
    state: delivered && !(hasShipment && sellerShippingCents === null) ? 'final' : 'estimated',
    note: notes.join(' '),
    revenueLines,
    feeLines,
    payoutCents,
    buyerPaidCents,
    costItems,
    rawFields,
  });
}

async function resolveMercadoLivreItemCosts(pool, lookupItems) {
  const items = Array.isArray(lookupItems) ? lookupItems : [];
  const itemIds = [...new Set(items.map((item) => item.item_id).filter(Boolean))];
  const links = [];
  if (itemIds.length) {
    const [rows] = await pool.query(
      `SELECT product_id, item_id, variation_id
         FROM mercado_livre_products
        WHERE item_id IN (${itemIds.map(() => '?').join(',')})`,
      itemIds,
    );
    for (const row of Array.isArray(rows) ? rows : []) {
      links.push({ product_id: row.product_id, item_id: cleanText(row.item_id).toUpperCase(), model_id: row.variation_id });
    }
  }
  return resolveItemCostsFromLinks(pool, items, links, 'marketplace_link');
}

async function safeResolveCosts(resolve, lookupItems) {
  try {
    return await resolve(lookupItems);
  } catch (costError) {
    console.error('[marketplace-sale-financials] cost lookup failed:', costError?.message || costError);
    return lookupItems.map((item) => ({ name: item.name, variation: item.variation || '', sku: item.sku || '', quantity: item.quantity, product_id: null, product_name: null, matched_by: null, unit_cost_cents: 0, total_cost_cents: 0 }));
  }
}

/**
 * fetchSource(orderId) deve devolver { order, shipmentCosts, shipmentCostsError } (JSON bruto do ML, só leitura).
 */
function createMercadoLivreSaleFinancialsLoader({ pool, fetchSource }) {
  return async function loadMercadoLivreSaleFinancials(sale) {
    const orderId = cleanText(sale?.external_id);
    if (!/^\d{1,30}$/.test(orderId)) return null;
    let source = null;
    let error = '';
    try {
      source = await fetchSource(orderId);
    } catch (fetchError) {
      error = `Não foi possível consultar as tarifas no Mercado Livre: ${cleanText(fetchError?.message || fetchError).slice(0, 160)}`;
    }
    const order = source?.order || null;
    const lookupItems = mercadoLivreCostLookupItems(order, sale?.details?.items);
    const costItems = await safeResolveCosts((items) => resolveMercadoLivreItemCosts(pool, items), lookupItems);
    return buildMercadoLivreSaleFinancials({
      order,
      shipmentCosts: source?.shipmentCosts || null,
      shipmentCostsError: source?.shipmentCostsError || '',
      costItems,
      saleItems: sale?.details?.items,
      error,
    });
  };
}

// --- TikTok Shop ----------------------------------------------------------

// Mesmo critério de utils/channelProfit.js (suggestTikTokFeesFromSummary): só campos do nível
// do pedido; totais agregados ficam fora para não contar duas vezes.
const TIKTOK_TOTAL_FIELD = /^(total_|net_)?(fees?|settlement|revenue|adjustment)_amount$|^total_/;
const TIKTOK_FIELD_LABELS = {
  platform_commission_amount: 'Comissão da plataforma',
  referral_fee_amount: 'Comissão de indicação',
  transaction_fee_amount: 'Taxa de transação',
  affiliate_commission_amount: 'Comissão de afiliados',
  affiliate_partner_commission_amount: 'Comissão de parceiro afiliado',
  sfp_service_fee_amount: 'Taxa de serviço SFP',
  shipping_cost_amount: 'Frete pago pelo vendedor',
  shipping_fee_amount: 'Frete pago pelo vendedor',
  actual_shipping_fee_amount: 'Frete pago pelo vendedor',
  tax_amount: 'Impostos',
  vat_amount: 'Impostos',
  voucher_xtra_service_fee_amount: 'Taxa de serviço de cupom',
};

const TIKTOK_SHIPPING_FIELD = /shipping|logistic|delivery/;

/** Frete líquido do vendedor: shipping_cost_amount quando vier; senão a soma (com sinal) da abertura. */
function tikTokNetShipping(totals) {
  if (Object.prototype.hasOwnProperty.call(totals, 'shipping_cost_amount')) {
    return { key: 'shipping_cost_amount', amount: Number(totals.shipping_cost_amount) || 0 };
  }
  const amount = Object.values(totals).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return { key: 'shipping_net', amount };
}

function tikTokFieldLabel(key) {
  if (key === 'shipping_net') return 'Frete pago pelo vendedor';
  if (TIKTOK_FIELD_LABELS[key]) return TIKTOK_FIELD_LABELS[key];
  if (/shipping|logistic|delivery/.test(key)) return `Frete (${key})`;
  if (/commission/.test(key)) return `Comissão (${key})`;
  if (/tax/.test(key)) return `Impostos (${key})`;
  return `Taxa (${key})`;
}

function tikTokNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

function tikTokCostLookupItems(order, saleItems = []) {
  const lineItems = Array.isArray(order?.line_items) ? order.line_items : [];
  if (lineItems.length) {
    return lineItems.map((item) => ({
      name: cleanText(item?.product_name || item?.display_name) || 'Item TikTok',
      variation: cleanText(item?.sku_name),
      sku: cleanText(item?.seller_sku),
      item_id: cleanText(item?.product_id),
      model_id: cleanText(item?.sku_id),
      quantity: Math.max(1, Number(item?.quantity) || 1),
      unit_price_cents: Math.max(0, safeAmountCents(item?.sale_price) || 0),
    }));
  }
  return (Array.isArray(saleItems) ? saleItems : []).map((item) => ({
    name: cleanText(item.name) || 'Item TikTok',
    variation: cleanText(item.variation),
    sku: cleanText(item.sku),
    item_id: '',
    model_id: '',
    quantity: Math.max(1, Number(item.quantity) || 1),
    unit_price_cents: Math.max(0, Math.round(Number(item.unit_price_cents) || 0)),
  }));
}

/**
 * Função pura. statement = data de GET /finance/202309/orders/{id}/statement_transactions.
 * errorCode 105005 = app sem escopo de Finanças (pendência tiktok_finance_scope).
 */
function buildTikTokSaleFinancials({ statement, order = null, orderStatus = '', costItems = [], saleItems = [], error = '', errorCode = null } = {}) {
  const lookupItems = tikTokCostLookupItems(order, saleItems);
  const common = { source: 'tiktok_statement', payoutLabel: 'Valor recebido do TikTok Shop', channelFeeId: 'tiktok', lookupItems, costItems };
  const status = normalizeStatus(orderStatus || order?.status);
  if (/CANCEL/.test(status)) {
    return unavailableChannelFinancials({ ...common, cancelled: true, reason: 'Pedido cancelado: não há valor a receber do TikTok Shop.' });
  }
  const transactions = Array.isArray(statement?.statement_transactions) ? statement.statement_transactions : [];
  if (!transactions.length) {
    const reason = Number(errorCode) === TIKTOK_SCOPE_ERROR_CODE
      ? 'O app do TikTok Shop ainda não tem permissão de Finanças (código 105005), então o extrato real não pode ser lido.'
      : (error || 'O TikTok ainda não gerou o extrato deste pedido (ele aparece após a conclusão).');
    return unavailableChannelFinancials({ ...common, reason });
  }

  let revenue = 0;
  let settlement = null;
  const fees = new Map();
  const raw = new Map();
  const shipping = new Map();
  for (const transaction of transactions) {
    for (const [key, value] of Object.entries(transaction || {})) {
      if (!/_amount$/.test(key) || (value && typeof value === 'object')) continue;
      const amount = tikTokNumber(value);
      if (amount === null) continue;
      raw.set(key, (raw.get(key) || 0) + amount);
      if (key === 'revenue_amount') { revenue += amount; continue; }
      if (key === 'settlement_amount') { settlement = (settlement || 0) + amount; continue; }
      if (TIKTOK_TOTAL_FIELD.test(key)) continue;
      if (TIKTOK_SHIPPING_FIELD.test(key)) { shipping.set(key, (shipping.get(key) || 0) + amount); continue; }
      if (!(amount < 0)) continue;
      fees.set(key, (fees.get(key) || 0) + amount);
    }
  }
  // tiktok-net-shipping-v1: o extrato traz o frete líquido (shipping_cost_amount) e a abertura dele
  // (frete cheio, subsídio da plataforma, frete pago pelo cliente...). Usa só o líquido.
  const shippingNet = tikTokNetShipping(Object.fromEntries(shipping));
  if (shippingNet.amount !== 0) fees.set(shippingNet.key, shippingNet.amount);
  const revenueCents = Math.round(revenue * 100);
  const feeLines = [...fees.entries()]
    .map(([key, amount]) => ({ key, label: tikTokFieldLabel(key), amount_cents: -Math.abs(Math.round(amount * 100)) }))
    .filter((line) => line.amount_cents !== 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  const explainedCents = revenueCents + sumCents(feeLines.map((line) => line.amount_cents));
  const payoutCents = settlement === null ? explainedCents : Math.round(settlement * 100);
  const residualCents = payoutCents - explainedCents;
  if (residualCents !== 0) feeLines.push({ key: 'other_adjustments', label: 'Frete e outros ajustes do TikTok', amount_cents: residualCents });
  const isFinal = /COMPLETED|DELIVERED/.test(status);

  return finishChannelFinancials({
    source: 'tiktok_statement',
    payoutLabel: 'Valor recebido do TikTok Shop',
    state: isFinal ? 'final' : 'estimated',
    note: isFinal ? 'Valores do extrato do TikTok Shop.' : 'Valores do extrato do TikTok Shop; podem mudar até a conclusão do pedido.',
    revenueLines: [{ key: 'revenue_amount', label: 'Receita do pedido', amount_cents: revenueCents }],
    feeLines,
    payoutCents,
    buyerPaidCents: null,
    costItems,
    rawFields: [...raw.entries()]
      .map(([key, amount]) => ({ key, label: key, amount_cents: Math.round(amount * 100) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  });
}

async function resolveTikTokItemCosts(pool, lookupItems) {
  const items = Array.isArray(lookupItems) ? lookupItems : [];
  const itemIds = [...new Set(items.map((item) => item.item_id).filter(Boolean))];
  const links = [];
  if (itemIds.length) {
    const [rows] = await pool.query(
      `SELECT product_id, tiktok_product_id, tiktok_sku_id
         FROM tiktok_shop_products
        WHERE tiktok_product_id IN (${itemIds.map(() => '?').join(',')})`,
      itemIds,
    );
    for (const row of Array.isArray(rows) ? rows : []) {
      links.push({ product_id: row.product_id, item_id: row.tiktok_product_id, model_id: row.tiktok_sku_id });
    }
  }
  return resolveItemCostsFromLinks(pool, items, links, 'marketplace_link');
}

/**
 * fetchStatement(orderId) → data do extrato (lança erro com tiktokCode quando a API recusa).
 * fetchOrder(orderId) → pedido bruto (line_items com product_id/sku_id) ou null.
 */
function createTikTokSaleFinancialsLoader({ pool, fetchStatement, fetchOrder = async () => null }) {
  return async function loadTikTokSaleFinancials(sale) {
    const orderId = cleanText(sale?.external_id);
    if (!/^[0-9A-Za-z_-]{1,64}$/.test(orderId)) return null;
    let statement = null;
    let error = '';
    let errorCode = null;
    try {
      statement = await fetchStatement(orderId);
    } catch (fetchError) {
      errorCode = fetchError?.tiktokCode ?? null;
      error = `Não foi possível ler o extrato do TikTok Shop: ${cleanText(fetchError?.message || fetchError).slice(0, 160)}`;
    }
    const order = await Promise.resolve().then(() => fetchOrder(orderId)).catch(() => null);
    const lookupItems = tikTokCostLookupItems(order, sale?.details?.items);
    const costItems = await safeResolveCosts((items) => resolveTikTokItemCosts(pool, items), lookupItems);
    return buildTikTokSaleFinancials({ statement, order, orderStatus: sale?.status, costItems, saleItems: sale?.details?.items, error, errorCode });
  };
}

// sale-profit-flag-v1: último lucro calculado de cada pedido de marketplace (real ou estimado), para a lista
// de Vendas destacar prejuízo sem consultar o marketplace pedido a pedido. Só um espelho do que o
// "Financeiro da venda" já mostrou: a fonte dos valores continua sendo o cálculo do detalhe.
const PROFIT_CHANNELS = new Set(['shopee_mv', 'shopee_g', 'mercado_livre', 'tiktok']);
let profitSchemaPromise = null;
function ensureMarketplaceSaleProfitSchema(pool) {
  profitSchemaPromise ||= pool.query(`CREATE TABLE IF NOT EXISTS marketplace_sale_profit (
      channel VARCHAR(32) NOT NULL,
      connection_id VARCHAR(64) NOT NULL DEFAULT '',
      external_id VARCHAR(64) NOT NULL,
      profit_cents BIGINT NOT NULL,
      origin VARCHAR(32) NULL,
      computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (channel, connection_id, external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch((error) => { profitSchemaPromise = null; throw error; });
  return profitSchemaPromise;
}

function profitKey(input) {
  const channel = String(input?.channel || '').trim();
  const connectionId = String(input?.connection_id || '').trim();
  const externalId = String(input?.external_id || '').trim();
  if (!PROFIT_CHANNELS.has(channel)) throw Object.assign(new Error('Canal inválido.'), { statusCode: 400 });
  if (!/^[A-Za-z0-9_-]{0,64}$/.test(connectionId) || !/^[A-Za-z0-9_-]{1,64}$/.test(externalId)) {
    throw Object.assign(new Error('Pedido inválido.'), { statusCode: 400 });
  }
  return { channel, connection_id: connectionId, external_id: externalId };
}

function normalizeSaleProfitInput(body = {}) {
  const key = profitKey(body);
  const profit = Number(body.profit_cents);
  if (!Number.isSafeInteger(profit)) throw Object.assign(new Error('Lucro inválido.'), { statusCode: 400 });
  const origin = ['marketplace', 'configured_fees'].includes(body.origin) ? body.origin : 'marketplace';
  return { ...key, profit_cents: profit, origin };
}

function registerMarketplaceSaleProfitRoutes(fastify, { pool, guard }) {
  fastify.put('/admin/marketplace-sale-profits', guard, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      const row = normalizeSaleProfitInput(req.body || {});
      await ensureMarketplaceSaleProfitSchema(pool);
      await pool.query(`INSERT INTO marketplace_sale_profit (channel,connection_id,external_id,profit_cents,origin) VALUES (?,?,?,?,?)
        ON DUPLICATE KEY UPDATE profit_cents=VALUES(profit_cents), origin=VALUES(origin)`,
      [row.channel, row.connection_id, row.external_id, row.profit_cents, row.origin]);
      return { ok: true };
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.statusCode ? error.message : 'Não foi possível registrar o lucro.' });
    }
  });
  fastify.post('/admin/marketplace-sale-profits/lookup', guard, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      const keys = (Array.isArray(req.body?.keys) ? req.body.keys : []).slice(0, 1000).map(profitKey);
      if (!keys.length) return { items: [] };
      await ensureMarketplaceSaleProfitSchema(pool);
      const [rows] = await pool.query(`SELECT channel,connection_id,external_id,profit_cents,origin,computed_at FROM marketplace_sale_profit
        WHERE (channel,connection_id,external_id) IN (${keys.map(() => '(?,?,?)').join(',')})`,
      keys.flatMap((key) => [key.channel, key.connection_id, key.external_id]));
      return { items: rows.map((row) => ({ ...row, profit_cents: Number(row.profit_cents) })) };
    } catch (error) {
      return reply.code(error.statusCode || 500).send({ error: error.statusCode ? error.message : 'Não foi possível consultar os lucros.' });
    }
  });
}

module.exports = {
  tikTokNetShipping,
  ensureMarketplaceSaleProfitSchema,
  normalizeSaleProfitInput,
  registerMarketplaceSaleProfitRoutes,
  buildShopeeSaleFinancials,
  buildMercadoLivreSaleFinancials,
  buildTikTokSaleFinancials,
  mercadoLivreCostLookupItems,
  tikTokCostLookupItems,
  resolveItemCostsFromLinks,
  createMercadoLivreSaleFinancialsLoader,
  createTikTokSaleFinancialsLoader,
  TIKTOK_SCOPE_ERROR_CODE,
  shopeeCostLookupItems,
  resolveShopeeItemCosts,
  createShopeeSaleFinancialsLoader,
  SHOPEE_FIELD_LABELS,
};
