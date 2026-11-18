import { vpsClient } from './vpsClient';

export type UnitTimelineEventType =
    | 'entry' | 'legacy_entry' | 'legacy_sale' | 'data_corrected' | 'reserved' | 'reservation_released'
    | 'sold' | 'sale_cancelled' | 'sale_refunded' | 'returned_to_stock' | 'warranty_issued' | 'warranty_signed'
    | 'rma' | 'hidden' | 'unhidden' | 'scrapped';

export interface UnitTimelineEvent {
    key: string;
    type: UnitTimelineEventType;
    at: string | null;
    title: string;
    detail: string | null;
    actor: string | null;
    saleId: string | null;
    orderId: string | null;
    intakeId: string | null;
}

export interface UnitTimelineCurrent {
    status: string;
    statusLabel: string;
    deposit: { id: string; name: string } | null;
    location: { id: string; name: string } | null;
    sale: { id: string; code: string; customerName: string; soldAt: string | null } | null;
    orderId: string | null;
    costCents: number | null;
    priceCents: number | null;
    daysInStock: number | null;
    timesSold: number;
    timesReturned: number;
}

export interface UnitTimelineResponse {
    unit: {
        id: string; product_id: string; imei: string | null; imei_1: string | null; imei_2: string | null;
        serial: string | null; condition: string | null; status: string; cost_price: number | null; created_at: string | null;
        intake_id: string | null;
    };
    product: { id: string; name: string; sku: string | null; image_url: string | null } | null;
    current: UnitTimelineCurrent;
    events: UnitTimelineEvent[];
}

export interface UnitTimelineMatches {
    matches: Array<{ id: string; productName: string | null; imei1: string | null; imei2: string | null; serial: string | null; status: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTimelineMatches(value: UnitTimelineResponse | UnitTimelineMatches): value is UnitTimelineMatches {
    return Array.isArray((value as UnitTimelineMatches).matches);
}

export async function getUnitTimeline(identifier: string): Promise<UnitTimelineResponse | UnitTimelineMatches> {
    const clean = identifier.trim();
    if (UUID.test(clean)) {
        return vpsClient.get<UnitTimelineResponse>(`/admin/units/${encodeURIComponent(clean)}/timeline`);
    }
    return vpsClient.get<UnitTimelineResponse | UnitTimelineMatches>(`/admin/units/timeline?identifier=${encodeURIComponent(clean)}`);
}
