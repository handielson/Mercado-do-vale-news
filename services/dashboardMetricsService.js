export function isSameLocalDay(value, now = new Date()) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
}

function formatLocalDateKey(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function resolveReferenceDate(sales, now = new Date()) {
  const validDates = (Array.isArray(sales) ? sales : [])
    .map((sale) => ({
      raw: sale?.created_at,
      key: formatLocalDateKey(sale?.created_at),
      time: new Date(sale?.created_at).getTime(),
    }))
    .filter((entry) => entry.key);

  if (validDates.some((entry) => isSameLocalDay(entry.raw, now))) {
    return {
      referenceDate: formatLocalDateKey(now),
      periodMode: 'today',
    };
  }

  const latest = validDates.sort((a, b) => b.time - a.time)[0];
  if (!latest) {
    return {
      referenceDate: formatLocalDateKey(now),
      periodMode: 'today',
    };
  }

  return {
    referenceDate: latest.key,
    periodMode: 'latest',
  };
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function buildProductCostLookup(products = []) {
  const lookup = new Map();
  for (const product of Array.isArray(products) ? products : []) {
    const id = product?.id == null ? '' : String(product.id);
    if (!id) continue;
    lookup.set(id, toFiniteNumber(product?.price_cost));
  }
  return lookup;
}

function getItemCostCents(item, productCostById = new Map()) {
  const directCost = toFiniteNumber(item?.unit_cost ?? item?.cost_price);
  if (directCost > 0) return directCost;

  const productId = item?.product_id == null ? '' : String(item.product_id);
  return toFiniteNumber(productCostById.get(productId));
}

export function calculateSaleProfitCents(sale, productCostById = new Map()) {
  const rowProfit = Number(sale?.profit);
  if (Number.isFinite(rowProfit) && rowProfit !== 0) return rowProfit;

  const items = Array.isArray(sale?.items) ? sale.items : [];
  const itemsProfit = items.reduce((profitAcc, item) => {
    const quantity = toFiniteNumber(item?.quantity);
    const itemTotal = item?.total == null
      ? toFiniteNumber(item?.unit_price) * quantity
      : toFiniteNumber(item.total);
    const costTotal = getItemCostCents(item, productCostById) * quantity;
    return profitAcc + itemTotal - costTotal;
  }, 0);

  if (items.length > 0 && itemsProfit !== 0) return itemsProfit;
  return Number.isFinite(rowProfit) ? rowProfit : 0;
}

export function buildDailyDashboardMetrics({ sales, now = new Date(), productCostById = new Map() }) {
  const { referenceDate, periodMode } = resolveReferenceDate(sales, now);

  const base = (Array.isArray(sales) ? sales : []).reduce((acc, sale) => {
    if (formatLocalDateKey(sale?.created_at) !== referenceDate) return acc;

    const saleRevenue = Number(sale?.total ?? sale?.total_amount) || 0;
    const saleProfit = calculateSaleProfitCents(sale, productCostById);

    return {
      revenueCents: acc.revenueCents + saleRevenue,
      profitCents: acc.profitCents + saleProfit,
      salesCount: acc.salesCount + 1,
    };
  }, {
      revenueCents: 0,
      profitCents: 0,
      salesCount: 0,
  });

  return {
    ...base,
    referenceDate,
    periodMode,
  };
}

export async function getDashboardDailyMetrics(now = new Date()) {
  const { getSales } = await import('./saleService');
  const { vpsApiService } = await import('./vpsApiService');
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 14);
  rangeStart.setHours(0, 0, 0, 0);

  const sales = await getSales({
    status: 'completed',
    start_date: rangeStart.toISOString(),
    end_date: now.toISOString(),
  });
  const productIds = Array.from(new Set(
    sales.flatMap((sale) => (Array.isArray(sale?.items) ? sale.items : [])
      .map((item) => item?.product_id)
      .filter(Boolean)
      .map(String))
  ));
  const products = productIds.length > 0
    ? (await vpsApiService.getProductsByIds(productIds).catch(() => null)) || []
    : [];

  return buildDailyDashboardMetrics({
    sales,
    now,
    productCostById: buildProductCostLookup(products),
  });
}

export async function unlockDashboardProfit({ password, referenceDate }) {
  const { vpsClient } = await import('./vpsClient');
  return vpsClient.post('/admin/dashboard/profit', {
    password,
    referenceDate,
  });
}
