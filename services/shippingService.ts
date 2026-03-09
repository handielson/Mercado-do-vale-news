/**
 * Shipping Service v2 — single-tenant, sem company_id
 */
import { supabase } from './supabase';
import type {
    ShippingSettings,
    ShippingSettingsInput,
    ShippingZone,
    ShippingZoneInput,
    ShippingPriceRange,
    ShippingPriceRangeInput,
    ShippingOption,
    ShippingCalculationInput,
} from '../types/shipping';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getCepInfo(cep: string): Promise<{ city: string; state: string; lat?: number; lng?: number } | null> {
    const clean = cep.replace(/\D/g, '');
    try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) return null;

        let lat: number | undefined;
        let lng: number | undefined;
        try {
            const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/search?postalcode=${clean}&country=BR&format=json&limit=1`,
                { headers: { 'Accept-Language': 'pt-BR' } }
            );
            const geoData = await geoRes.json();
            if (geoData?.[0]) {
                lat = parseFloat(geoData[0].lat);
                lng = parseFloat(geoData[0].lon);
            }
        } catch { /* coords optional */ }

        return { city: data.localidade, state: data.uf, lat, lng };
    } catch {
        return null;
    }
}

function cepInRanges(cep: string, ranges: string[]): boolean {
    const clean = cep.replace(/\D/g, '');
    return ranges.some((range) => {
        const [from, to] = range.split(':').map((c) => c.replace(/\D/g, ''));
        return clean >= from && clean <= to;
    });
}

function daysLabel(min: number, max: number): string {
    if (min === 0 && max === 0) return 'Hoje';
    if (min === max) return `${min} dia${min > 1 ? 's úteis' : ' útil'}`;
    return `${min}–${max} dias úteis`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const shippingService = {

    // ── Settings ──────────────────────────────────────────────────────────────

    async getSettings(): Promise<ShippingSettings | null> {
        const { data } = await supabase
            .from('shipping_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
        return data;
    },

    async saveSettings(input: ShippingSettingsInput): Promise<void> {
        // Try update first, then insert if no row exists
        const existing = await shippingService.getSettings();
        if (existing?.id) {
            const { error } = await supabase
                .from('shipping_settings')
                .update({ ...input, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            if (error) throw error;
        } else {
            const { error } = await supabase
                .from('shipping_settings')
                .insert({ ...input, updated_at: new Date().toISOString() });
            if (error) throw error;
        }
    },

    // ── Zones ────────────────────────────────────────────────────────────────

    async getZones(): Promise<ShippingZone[]> {
        const { data, error } = await supabase
            .from('shipping_zones')
            .select('*, price_ranges:shipping_price_ranges(*)')
            .order('display_order');
        if (error) {
            console.error('[shippingService] getZones error:', error);
            return [];
        }
        return (data as any[]) ?? [];
    },

    async saveZone(input: ShippingZoneInput, id?: string): Promise<ShippingZone> {
        const query = id
            ? supabase.from('shipping_zones').update(input).eq('id', id).select().single()
            : supabase.from('shipping_zones').insert(input).select().single();
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async deleteZone(id: string): Promise<void> {
        const { error } = await supabase.from('shipping_zones').delete().eq('id', id);
        if (error) throw error;
    },

    // ── Price Ranges ─────────────────────────────────────────────────────────

    async getPriceRanges(zoneId: string): Promise<ShippingPriceRange[]> {
        const { data } = await supabase
            .from('shipping_price_ranges')
            .select('*')
            .eq('zone_id', zoneId)
            .order('min_km');
        return data ?? [];
    },

    async savePriceRange(input: ShippingPriceRangeInput, id?: string): Promise<ShippingPriceRange> {
        const query = id
            ? supabase.from('shipping_price_ranges').update(input).eq('id', id).select().single()
            : supabase.from('shipping_price_ranges').insert(input).select().single();
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async deletePriceRange(id: string): Promise<void> {
        const { error } = await supabase.from('shipping_price_ranges').delete().eq('id', id);
        if (error) throw error;
    },

    // ── Calculation ───────────────────────────────────────────────────────────

    async calculate(input: ShippingCalculationInput): Promise<ShippingOption[]> {
        const options: ShippingOption[] = [];

        const [settings, zones] = await Promise.all([
            shippingService.getSettings(),
            shippingService.getZones(),
        ]);

        const destInfo = await getCepInfo(input.to_cep);
        if (!destInfo) return [];

        let originCoords: { lat: number; lng: number } | null = null;
        if (settings?.origin_cep) {
            const originInfo = await getCepInfo(settings.origin_cep);
            if (originInfo?.lat && originInfo?.lng) {
                originCoords = { lat: originInfo.lat, lng: originInfo.lng };
            }
        }

        let distanceKm: number | null = null;
        if (originCoords && destInfo.lat && destInfo.lng) {
            distanceKm = haversineKm(originCoords.lat, originCoords.lng, destInfo.lat, destInfo.lng);
        }

        const activeZones = zones.filter((z) => z.enabled);

        for (const zone of activeZones) {
            const cityMatch = zone.cities?.some(
                (c) => c.toLowerCase() === destInfo.city.toLowerCase()
            );
            const cepMatch = zone.cep_ranges?.length > 0
                ? cepInRanges(input.to_cep, zone.cep_ranges)
                : false;

            const matches = cityMatch || cepMatch;
            if (!matches && zone.type !== 'national') continue;

            if (zone.type === 'local_free') {
                const withinRadius =
                    !zone.max_km_free || distanceKm === null || distanceKm <= zone.max_km_free;
                const meetsMinOrder =
                    !zone.min_order_free || !input.order_value || input.order_value >= zone.min_order_free;

                if (withinRadius && meetsMinOrder) {
                    options.push({
                        id: zone.id,
                        name: zone.name,
                        price: 0,
                        isFree: true,
                        estimatedDaysMin: zone.estimated_days_min,
                        estimatedDaysMax: zone.estimated_days_max,
                        daysLabel: daysLabel(zone.estimated_days_min, zone.estimated_days_max),
                        type: 'local_free',
                    });
                }

            } else if (zone.type === 'local_paid') {
                if (zone.price_ranges && zone.price_ranges.length > 0 && distanceKm !== null) {
                    const range = zone.price_ranges.find(
                        (r) => distanceKm! >= r.min_km && (r.max_km === null || distanceKm! <= r.max_km)
                    );
                    if (range) {
                        options.push({
                            id: zone.id,
                            name: `${zone.name} (${range.label})`,
                            price: range.price,
                            isFree: range.price === 0,
                            estimatedDaysMin: range.estimated_days_min,
                            estimatedDaysMax: range.estimated_days_max,
                            daysLabel: daysLabel(range.estimated_days_min, range.estimated_days_max),
                            type: 'local_paid',
                        });
                        continue;
                    }
                }

                let price = 0;
                if (zone.fixed_price != null) {
                    price = zone.fixed_price;
                } else if (zone.price_per_km && distanceKm !== null) {
                    price = Math.ceil(distanceKm * zone.price_per_km);
                }

                options.push({
                    id: zone.id,
                    name: zone.name,
                    price,
                    isFree: price === 0,
                    estimatedDaysMin: zone.estimated_days_min,
                    estimatedDaysMax: zone.estimated_days_max,
                    daysLabel: daysLabel(zone.estimated_days_min, zone.estimated_days_max),
                    type: 'local_paid',
                });
            } else if (zone.type === 'national') {
                if (zone.fixed_price != null) {
                    options.push({
                        id: zone.id,
                        name: zone.name,
                        price: zone.fixed_price,
                        isFree: zone.fixed_price === 0,
                        estimatedDaysMin: zone.estimated_days_min,
                        estimatedDaysMax: zone.estimated_days_max,
                        daysLabel: daysLabel(zone.estimated_days_min, zone.estimated_days_max),
                        type: 'national',
                    });
                }
            }
        }

        // Melhor Envio fallback
        if (settings?.melhor_envio_enabled && options.length === 0) {
            try {
                const { melhorEnvioService } = await import('./melhorEnvio');
                const carriers = await melhorEnvioService.calculate({
                    from_cep: settings.origin_cep,
                    to_cep: input.to_cep,
                    weight: input.weight ?? 300,
                    height: input.height ?? 10,
                    width: input.width ?? 15,
                    length: input.length ?? 20,
                    sandbox: settings.melhor_envio_sandbox,
                    token: settings.melhor_envio_token ?? '',
                    allowed_services: settings.melhor_envio_allowed_services,
                });
                if (carriers.length === 0) {
                    options.push({
                        id: 'dev_dbg_2',
                        name: 'DEBUG: Melhor Envio recused / filtered all options - Allowed: ' + (settings.melhor_envio_allowed_services || 'none'),
                        price: 0,
                        isFree: true,
                        estimatedDaysMin: 0,
                        estimatedDaysMax: 0,
                        daysLabel: 'Debug',
                        type: 'carrier'
                    });
                } else {
                    options.push(...carriers);
                }
            } catch (e: any) {
                console.warn('[shippingService] Melhor Envio error:', e);
                options.push({
                    id: 'dev_dbg_1',
                    name: 'DEBUG: Melhor Envio Error: ' + e.message,
                    price: 0,
                    isFree: true,
                    estimatedDaysMin: 0,
                    estimatedDaysMax: 0,
                    daysLabel: 'Debug',
                    type: 'carrier'
                });
            }
        } else if (!settings?.melhor_envio_enabled && options.length === 0) {
            options.push({
                id: 'dev_dbg_3',
                name: 'DEBUG: Melhor Envio is DISABLED in settings',
                price: 0,
                isFree: true,
                estimatedDaysMin: 0,
                estimatedDaysMax: 0,
                daysLabel: 'Debug',
                type: 'carrier'
            });
        }

        return options.sort((a, b) => {
            if (a.isFree && !b.isFree) return -1;
            if (!a.isFree && b.isFree) return 1;
            return a.price - b.price;
        });
    },
};
