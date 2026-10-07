// Informational marker persisted in the existing sales.notes field.
// It never participates in payments, fees, balances or credit decisions.
export const PAYJOY_SALE_NOTE = 'Venda via PayJoy';

export function isPayJoySale(sale) {
  return typeof sale?.notes === 'string'
    && sale.notes.split(/\r?\n/).some(line => line.trim() === PAYJOY_SALE_NOTE);
}

export function withPayJoySaleNote(notes, enabled) {
  const existing = typeof notes === 'string' ? notes : '';
  if (enabled) {
    if (isPayJoySale({ notes: existing })) return existing;
    return existing ? `${existing}${existing.endsWith('\n') ? '' : '\n'}${PAYJOY_SALE_NOTE}` : PAYJOY_SALE_NOTE;
  }
  if (!isPayJoySale({ notes: existing })) return existing || undefined;
  return existing.split(/\r?\n/).filter(line => line.trim() !== PAYJOY_SALE_NOTE).join('\n') || undefined;
}
