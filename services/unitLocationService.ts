import { vpsClient } from './vpsClient';

export interface UnitTransferMoved {
    unitId: string;
    productId: string;
    from: { depositId: string | null; locationId: string | null };
    to: { depositId: string; locationId: string };
}

export interface StockMismatch {
    productId: string;
    sku: string | null;
    name: string;
    units: number;
    balance: number;
}

export interface UnitTransferSkipped {
    identifier: string;
    unitId: string;
    reason: string;
}

export async function transferUnits(input: {
    identifiers: string[];
    toDepositId: string;
    toLocationId: string;
    reason?: string;
}): Promise<{ moved: UnitTransferMoved[]; skipped?: UnitTransferSkipped[] }> {
    return vpsClient.post<{ moved: UnitTransferMoved[]; skipped?: UnitTransferSkipped[] }>('/admin/units/transfers', {
        identifiers: input.identifiers,
        to_deposit_id: input.toDepositId,
        to_location_id: input.toLocationId,
        reason: input.reason?.trim() || undefined,
    });
}

export async function getStockMismatches(): Promise<StockMismatch[]> {
    const data = await vpsClient.get<{ rows: StockMismatch[] }>('/admin/units/stock-mismatches');
    return data.rows || [];
}
