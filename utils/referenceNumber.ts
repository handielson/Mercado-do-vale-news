/** Numero curto exibido ao operador e enviado a integracoes externas. */
export function formatReferenceNumber(value: unknown): string {
    return String(value || '').trim().slice(0, 8).toUpperCase();
}
