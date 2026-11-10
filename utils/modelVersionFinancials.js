// model-version-financials-v1: números financeiros por versão (RAM + armazenamento + versão/condição) da Página do Produto.
//
// Fontes (nenhuma nova):
// - preços de venda e custo: grupo de preço do celular (GET /models/:id/smartphone-price-groups),
//   o mesmo usado pela Gestão de Modelos e pelo cadastro da família;
// - vendas: unidades vendidas já agregadas pela Página do Produto (aggregateModelProducts),
//   com o valor recebido e o custo registrado em cada venda.

export const SALE_TIERS = [
  { key: 'price_retail', label: 'Varejo' },
  { key: 'price_reseller', label: 'Revenda' },
  { key: 'price_wholesale', label: 'Atacado' },
];

const finite = (value) => (value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);

/** Unidades da Página do Produto indexadas pelo cadastro (productId). */
export function unitsByProductId(memoryGroups = []) {
  const map = new Map();
  for (const memoryGroup of memoryGroups || []) {
    for (const colorGroup of memoryGroup.colors || []) {
      for (const unit of colorGroup.units || []) {
        const id = String(unit.productId || '');
        if (!id) continue;
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(unit);
      }
    }
  }
  return map;
}

/** Cadastro bruto (linha de products) de cada id, para ler a promoção. */
export function rawProductById(memoryGroups = []) {
  const map = new Map();
  for (const memoryGroup of memoryGroups || []) {
    for (const product of memoryGroup.products || []) {
      if (product?.id) map.set(String(product.id), product.raw || product);
    }
  }
  return map;
}

const ms = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Promoção por tempo limitado de uma versão. A promoção mora em cada cadastro
 * (products.price_promo/promo_start/promo_end, a mesma do formulário do produto e da campanha do Marketing);
 * aqui só se lê. Mesma regra de promoPricingCore.isPromoActive.
 */
export function versionPromo(productIds, rawById, retailCents, now = Date.now()) {
  const rows = productIds.map((id) => rawById.get(String(id))).filter(Boolean);
  if (!rows.length) return null;
  const key = (row) => [Math.round(Number(row.price_promo) || 0), ms(row.promo_start), ms(row.promo_end)].join('|');
  const withPromo = rows.filter((row) => Math.round(Number(row.price_promo) || 0) > 0);
  if (!withPromo.length) return null;
  const divergent = new Set(rows.map(key)).size > 1;
  const first = withPromo[0];
  const priceCents = Math.round(Number(first.price_promo));
  const start = ms(first.promo_start);
  const end = ms(first.promo_end);
  const retail = Number(retailCents) || Math.round(Number(first.price_retail) || 0);
  let status = 'active';
  if (!retail || priceCents >= retail) status = 'invalid';
  else if (start !== null && start > now) status = 'scheduled';
  else if (end !== null && end < now) status = 'expired';
  return {
    priceCents,
    start: start === null ? null : new Date(start).toISOString(),
    end: end === null ? null : new Date(end).toISOString(),
    status,
    divergent,
    withPromoCount: withPromo.length,
    total: rows.length,
    discountPct: retail > 0 && priceCents < retail ? Math.round(((retail - priceCents) / retail) * 100) : 0,
  };
}

/** Mesma validação do formulário do produto: preço acima de zero e abaixo do varejo; fim depois do início. */
export function validatePromo({ priceCents, start, end }, retailCents) {
  if (!Number.isSafeInteger(Number(priceCents)) || Number(priceCents) <= 0) return 'Informe o preço promocional.';
  if (Number(retailCents) > 0 && Number(priceCents) >= Number(retailCents)) return 'O preço promocional precisa ser menor que o varejo.';
  const s = ms(start); const e = ms(end);
  if (start && s === null) return 'Data de início inválida.';
  if (end && e === null) return 'Data de fim inválida.';
  if (s !== null && e !== null && e <= s) return 'O fim da promoção precisa ser depois do início.';
  return '';
}

/** Link público (/produto/<slug>) de cada cadastro, como a Página do Produto já monta (productLinks). */
export function publicUrlByProductId(memoryGroups = []) {
  const map = new Map();
  for (const memoryGroup of memoryGroups || []) {
    for (const product of memoryGroup.products || []) {
      if (product?.id && product.publicUrl) map.set(String(product.id), product.publicUrl);
    }
  }
  return map;
}

/** Quantidade e valor de compra em estoque de uma versão, com a mesma regra do servidor (presentGroup). */
function stockOf(group) {
  let quantity = 0;
  let value = 0;
  for (const product of group.products || []) {
    const unitCosts = Array.isArray(product.unit_costs) ? product.unit_costs.filter((cost) => Number.isSafeInteger(Number(cost)) && Number(cost) >= 0) : [];
    if (unitCosts.length || Number(product.available_unit_count || 0) > 0) {
      quantity += Number(product.available_unit_count || unitCosts.length || 0);
      value += unitCosts.reduce((sum, cost) => sum + Number(cost), 0);
    } else {
      const qty = Math.max(0, Number(product.stock_quantity || 0));
      quantity += qty;
      if (finite(product.price_cost) !== null) value += qty * Number(product.price_cost);
    }
  }
  return { quantity, value };
}

export function versionLabel(group) {
  const condition = group.condition && group.condition !== 'new' ? group.condition : '';
  return [group.ram, group.storage, group.version, group.network, condition].filter(Boolean).join(' · ');
}

/**
 * Lucro previsto de um preço sobre o custo base (centavos).
 * Sem taxas de canal: é o lucro bruto da venda na loja/site. Taxas por canal ficam no bloco "por canal".
 */
export function tierProfit(priceCents, costCents) {
  const price = finite(priceCents);
  const cost = finite(costCents);
  if (price === null || price <= 0 || cost === null) return null;
  const profit = price - cost;
  return { profitCents: profit, marginPct: Math.round((profit / price) * 1000) / 10 };
}

/**
 * Uma linha por versão (grupo de preço). Nada é somado entre versões diferentes.
 * @param {Array} groups grupos de GET /models/:id/smartphone-price-groups
 * @param {Array} memoryGroups memoryGroups de aggregateModelProducts (para as vendas)
 */
export function buildVersionFinancials(groups = [], memoryGroups = []) {
  const units = unitsByProductId(memoryGroups);
  const urls = publicUrlByProductId(memoryGroups);
  const raws = rawProductById(memoryGroups);
  return [...(groups || [])]
    .sort((a, b) => `${a.ram} ${a.storage} ${a.version || '~'} ${a.condition || ''}`.localeCompare(`${b.ram} ${b.storage} ${b.version || '~'} ${b.condition || ''}`, 'pt-BR', { numeric: true }))
    .map((group) => {
      const stock = stockOf(group);
      const averageStockCost = finite(group.cost_average_in_stock);
      const movingAverageCost = finite(group.moving_average_cost);
      // Custo que a venda vai registrar: média móvel do celular; sem ela, a média da compra em estoque.
      const costBaseCents = movingAverageCost ?? averageStockCost;
      const costBaseSource = movingAverageCost !== null ? 'custo médio móvel (usado nas vendas)' : averageStockCost !== null ? 'custo médio da compra em estoque' : null;

      const productIds = new Set((group.products || []).map((product) => String(product.id)));
      const sold = [...productIds].flatMap((id) => (units.get(id) || []).filter((unit) => unit.status === 'sold'));
      const withPrice = sold.filter((unit) => Number(unit.returnedValue) > 0 && !unit.returnedValueEstimated);
      const withProfit = withPrice.filter((unit) => Number(unit.costValue) > 0);
      const practicedTotal = withPrice.reduce((sum, unit) => sum + Number(unit.returnedValue), 0);
      const profitTotal = withProfit.reduce((sum, unit) => sum + Number(unit.returnedValue) - Number(unit.costValue), 0);

      const prices = group.prices || null;
      // Página da versão no site: prefere a cor que tem estoque.
      const linked = [...(group.products || [])]
        .sort((a, b) => Number(b.available_unit_count || b.stock_quantity || 0) - Number(a.available_unit_count || a.stock_quantity || 0))
        .find((product) => urls.has(String(product.id)));
      return {
        id: group.id,
        group,
        label: versionLabel(group),
        publicUrl: linked ? urls.get(String(linked.id)) : null,
        productIds: [...productIds],
        promo: (() => {
          const promo = versionPromo([...productIds], raws, prices?.price_retail);
          return promo ? { ...promo, ...(tierProfit(promo.priceCents, costBaseCents) || {}) } : null;
        })(),
        colors: [...new Set((group.products || []).map((product) => product.color).filter(Boolean))],
        divergent: Boolean(group.divergent),
        stockQuantity: stock.quantity,
        stockValueCents: stock.value,
        averageStockCostCents: averageStockCost,
        movingAverageCostCents: movingAverageCost,
        costMinCents: finite(group.cost_min),
        costMaxCents: finite(group.cost_max),
        costBaseCents,
        costBaseSource,
        prices,
        tiers: SALE_TIERS.map((tier) => ({
          ...tier,
          priceCents: prices ? finite(prices[tier.key]) : null,
          ...(prices ? tierProfit(prices[tier.key], costBaseCents) || {} : {}),
        })),
        soldCount: sold.length,
        soldWithPriceCount: withPrice.length,
        practicedAverageCents: withPrice.length ? Math.round(practicedTotal / withPrice.length) : null,
        realizedProfitAverageCents: withProfit.length ? Math.round(profitTotal / withProfit.length) : null,
        realizedProfitTotalCents: withProfit.length ? profitTotal : null,
      };
    });
}

/** Mesma regra do cadastro da família: os três preços acima de zero e varejo ≥ revenda ≥ atacado. */
export function validateSalePrices(prices) {
  const values = SALE_TIERS.map((tier) => Number(prices?.[tier.key]));
  if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) return 'Informe varejo, revenda e atacado acima de zero.';
  if (values[0] < values[1] || values[1] < values[2]) return 'Os preços precisam seguir a ordem varejo ≥ revenda ≥ atacado.';
  return '';
}
