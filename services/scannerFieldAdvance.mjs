export const SCANNER_FAST_KEY_GAP_MS = 50;
export const SCANNER_IDLE_MS = 140;
export const SCANNER_MIN_FAST_KEYS = 8;

export function nextScannerBurst(previous, field, timestamp) {
  const continues = previous?.field === field
    && timestamp >= previous.lastAt
    && timestamp - previous.lastAt <= SCANNER_FAST_KEY_GAP_MS;
  return { field, lastAt: timestamp, count: continues ? previous.count + 1 : 1 };
}

export function isScannerValueComplete(field, value) {
  const text = String(value || '').trim();
  if (field === 'detected_serial') return text.length >= SCANNER_MIN_FAST_KEYS;
  if (field === 'detected_imei_1' || field === 'detected_imei_2') return /^\d{15}$/.test(text);
  return false;
}
