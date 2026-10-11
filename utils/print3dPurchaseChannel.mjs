// Purchase origin belongs to a receipt, not to the material identity or cost/kg.
// Persist it in the existing immutable movement reference, so both preview and
// central stock keep the same approval, CAS and idempotency contract.
export const FILAMENT_PURCHASE_CHANNELS = ['Shopee', 'Mercado Livre', 'AliExpress', 'Amazon', 'Site do fabricante', 'Fornecedor direto', 'Loja física', 'Outro'];

export function filamentPurchaseNote(movement, channel = '', otherChannel = '') {
  const note = String(movement.note || '').trim();
  if (movement.reason !== 'receipt' || !channel) return note;
  if (!FILAMENT_PURCHASE_CHANNELS.includes(channel)) throw new Error('Selecione um canal de compra válido.');
  const origin = channel === 'Outro' ? String(otherChannel || '').trim() : channel;
  if (!origin || origin.length > 80 || /[\u0000-\u001f\u007f]/.test(origin)) throw new Error('Informe o outro canal de compra (até 80 caracteres).');
  const reference = `Canal de compra: ${origin}${note ? ` | Referência: ${note}` : ''}`;
  if (reference.length > 500) throw new Error('Canal de compra e referência devem ter até 500 caracteres juntos.');
  return reference;
}
