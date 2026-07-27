function clampToZero(value) {
  return Math.max(0, Number(value) || 0);
}

export function formatQueueDigestDate(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatPurchaseQueueSalesLabel(item = {}, now = new Date()) {
  const quantity = clampToZero(item.last_digest_quantity);
  const quantityLabel = `${quantity} ${quantity === 1 ? 'vendida' : 'vendidas'}`;
  const digestDate = String(item.last_digest_date || '').trim();
  const today = formatQueueDigestDate(now);
  if (!digestDate || digestDate === today) return `${quantityLabel} hoje`;

  const match = digestDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return `${quantityLabel} na ultima atualizacao`;
  return `${quantityLabel} em ${match[3]}/${match[2]}/${match[1]}`;
}
