export function moneyInputToCents(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = cleaned
      .replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '')
      .replace(decimalSeparator, '.');
  } else if (lastComma >= 0) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    const parts = cleaned.split('.');
    const decimalPart = parts.length === 2 ? parts[1] : '';
    normalized = decimalPart.length >= 1 && decimalPart.length <= 2
      ? cleaned
      : cleaned.replace(/\./g, '');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}
