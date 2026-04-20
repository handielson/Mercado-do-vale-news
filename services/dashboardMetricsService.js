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

export function buildDailyDashboardMetrics({ sales, now = new Date() }) {
  const { referenceDate, periodMode } = resolveReferenceDate(sales, now);

  const base = (Array.isArray(sales) ? sales : []).reduce((acc, sale) => {
    if (formatLocalDateKey(sale?.created_at) !== referenceDate) return acc;

    const saleRevenue = Number(sale?.total ?? sale?.total_amount) || 0;
    const saleProfitFromRow = Number(sale?.profit);

    const saleProfit = Number.isFinite(saleProfitFromRow)
      ? saleProfitFromRow
      : (Array.isArray(sale?.items) ? sale.items : []).reduce((profitAcc, item) => {
          const quantity = Number(item?.quantity) || 0;
          const unitPrice = Number(item?.unit_price ?? item?.total) || 0;
          const costPrice = Number(item?.cost_price ?? item?.unit_cost) || 0;
          return profitAcc + ((unitPrice - costPrice) * quantity);
        }, 0);

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
  const { supabase } = await import('./supabase');
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 14);
  rangeStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('sales')
    .select('created_at, total, total_amount, profit')
    .eq('status', 'completed')
    .gte('created_at', rangeStart.toISOString())
    .lte('created_at', now.toISOString());

  if (error) {
    throw error;
  }

  return buildDailyDashboardMetrics({
    sales: data || [],
    now,
  });
}
