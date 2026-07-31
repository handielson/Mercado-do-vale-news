import type { SaleItem } from '../types/sale';

function clean(value: unknown): string {
    return String(value || '').trim();
}

/**
 * Seleciona somente itens que possuem evidencias de serializacao na propria
 * venda. O IMEI persistido no sale_item e aceito para reimpressoes antigas,
 * mas nunca inferimos um aparelho a partir da ordem dos itens ou dos specs.
 */
export function getWarrantySaleItems(items: SaleItem[]): SaleItem[] {
    return items.filter((item) => Boolean(
        clean((item as any).serialized_unit_id)
        || clean((item as any).imei)
        || clean(item.serialized_unit?.unitId)
        || clean(item.serialized_unit?.imei1)
        || clean(item.serialized_unit?.serial)
    ));
}

export function getSaleItemRecordedIdentifier(item: SaleItem): string {
    return clean((item as any).imei)
        || clean(item.serialized_unit?.imei1)
        || clean(item.serialized_unit?.serial);
}
