// entrada-ajustes (v1.2.804): recuperação do formulário de produto.

/**
 * Nova tentativa do produto único (o primeiro envio já criou o produto, guardado no checkpoint).
 * No cadastro novo, omite stock_quantity: com o campo omitido o servidor mantém o saldo, e uma
 * entrada feita pela tela Entrada entre as tentativas não é zerada. O primeiro envio continua com 0.
 * @param {Record<string, any>} mergedData
 * @param {{ sku?: string | null }} checkpoint
 * @param {boolean} isNewRegistration
 * @returns {Record<string, any>}
 */
export function singleRetryUpdatePayload(mergedData, checkpoint, isNewRegistration) {
  const payload = { ...mergedData, sku: checkpoint?.sku };
  if (isNewRegistration) delete payload.stock_quantity;
  return payload;
}

/** Aba Bipar da Entrada, onde os aparelhos do rascunho antigo recebem entrada. */
export const LEGACY_DRAFT_SERIAL_ENTRY_PATH = '/admin/entrada?aba=bipar';

/**
 * Itens da lista de seriais de um rascunho salvo antes da v1.2.803 (o formulário não usa mais a lista).
 * @param {{ serialList?: unknown } | null | undefined} snapshot
 * @returns {number}
 */
export function legacyDraftSerialCount(snapshot) {
  return Array.isArray(snapshot?.serialList) ? snapshot.serialList.length : 0;
}

/** @param {number} count */
export function legacyDraftSerialNotice(count) {
  return `Este rascunho tinha ${count} aparelho(s) na lista de seriais. Dê entrada deles pela tela Entrada.`;
}

/**
 * Quantos aparelhos o aviso do rascunho antigo deve mostrar agora: só na primeira abertura do
 * rascunho neste navegador (marca como visto). Sem storage (janela privada, bloqueio), mostra.
 * @param {{ id?: string, snapshot?: { serialList?: unknown } } | null | undefined} draft
 * @param {{ getItem(key: string): string | null, setItem(key: string, value: string): void } | null | undefined} storage
 * @returns {number}
 */
export function takeLegacyDraftSerialNotice(draft, storage) {
  const count = legacyDraftSerialCount(draft?.snapshot);
  if (!count || !draft?.id) return count;
  const key = `mdv:legacy-serial-notice:${draft.id}`;
  try {
    if (storage?.getItem(key)) return 0;
    storage?.setItem(key, '1');
  } catch { /* sem storage: mostra o aviso */ }
  return count;
}
