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
    ShippingCalculationResult,
} from '../types/shipping';
import { vpsApiService } from './vpsApiService';

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
        try {
            const data = await vpsApiService.getShippingSettings();
            if (data) return data as ShippingSettings;
        } catch (e) {
            console.error('[shippingService] getSettings fallback to supabase:', e);
        }
        // Fallback or old data
        const { data } = await supabase
            .from('shipping_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
        return data as ShippingSettings | null;
    },

    async saveSettings(input: ShippingSettingsInput): Promise<void> {
        // Salva simultaneamente no banco local/Supabase e no VPS (Master)
        const existing = await shippingService.getSettings();
        
        // Remove campos que ainda não existem no schema do Supabase local (Fallback) para evitar 400 Bad Request
        const { 
            enable_progressive_shipping_subsidy, 
            min_order_value_for_subsidy, 
            default_subsidy_discount_percent, 
            profit_margin_percentage_cap, 
            ...supabaseInput 
        } = input;

        let localError;
        if (existing?.id) {
            const { error } = await supabase
                .from('shipping_settings')
                .update({ ...supabaseInput, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
            localError = error;
        } else {
            const { error } = await supabase
                .from('shipping_settings')
                .insert({ ...supabaseInput, updated_at: new Date().toISOString() });
            localError = error;
        }

        // Tenta jogar na VPS como Source of Truth principal (Single-tenant view)
        // Passa o input completo para o VPS, que já deve ter a tabela atualizada
        try {
            await vpsApiService.syncShippingSettings(input);
        } catch (e) {
            console.warn('[shippingService] Failed to sync shipping_settings with VPS', e);
        }

        if (localError) throw localError;
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

    async calculate(input: ShippingCalculationInput): Promise<ShippingCalculationResult> {
        let options: ShippingOption[] = [];
        let missingForFree: number | undefined = undefined;

        const [settings, zones] = await Promise.all([
            shippingService.getSettings(),
            shippingService.getZones(),
        ]);

        const destInfo = await getCepInfo(input.to_cep);
        if (!destInfo) return { options: [] };

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

            const isLocal = zone.type === 'local_free' || zone.type === 'local_paid';
            const withinRadius = isLocal ? (!zone.max_km_free || distanceKm === null || distanceKm <= zone.max_km_free) : false;

            if (isLocal && withinRadius && zone.min_order_free && input.order_value !== undefined) {
                if (input.order_value < zone.min_order_free) {
                    const diff = zone.min_order_free - input.order_value;
                    if (missingForFree === undefined || diff < missingForFree) {
                        missingForFree = diff;
                    }
                }
            }

            if (zone.type === 'local_free') {
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
                const meetsMinOrder = zone.min_order_free && input.order_value && input.order_value >= zone.min_order_free;

                if (meetsMinOrder && withinRadius) {
                    options.push({
                        id: zone.id,
                        name: zone.name,
                        price: 0,
                        isFree: true,
                        estimatedDaysMin: zone.estimated_days_min,
                        estimatedDaysMax: zone.estimated_days_max,
                        daysLabel: daysLabel(zone.estimated_days_min, zone.estimated_days_max),
                        type: 'local_paid',
                    });
                    continue;
                }

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

        // Carriers nacionais: Melhor Envio + Frenet — dual-origin em paralelo
        if (settings) {
            // Origens: primária + secundária (se existir)
            const origins: Array<{ cep: string; label: string }> = [
                { cep: settings.origin_cep, label: settings.origin_label || 'Depósito 1' },
            ];
            if (settings.secondary_origin_cep) {
                origins.push({
                    cep: settings.secondary_origin_cep,
                    label: settings.secondary_origin_label || 'Depósito 2',
                });
            }

            // Para cada origem, calcula ME + Frenet em paralelo
            const originResults = await Promise.allSettled(
                origins.map(async (origin) => {
                    const originOptions: ShippingOption[] = [];
                    const tasks: Promise<void>[] = [];

                    if (settings.melhor_envio_enabled && settings.melhor_envio_token) {
                        tasks.push(
                            (async () => {
                                try {
                                    const { melhorEnvioService } = await import('./melhorEnvio');
                                    const carriers = await melhorEnvioService.calculate({
                                        from_cep: origin.cep,
                                        to_cep: input.to_cep,
                                        weight: input.weight ?? 300,
                                        height: input.height ?? 10,
                                        width: input.width ?? 15,
                                        length: input.length ?? 20,
                                        sandbox: settings.melhor_envio_sandbox,
                                        token: settings.melhor_envio_token ?? '',
                                        allowed_services: settings.melhor_envio_allowed_services,
                                    });
                                    originOptions.push(...carriers.map(c => ({
                                        ...c,
                                        origin_cep: origin.cep,
                                        origin_label: origin.label,
                                    })));
                                } catch (e: any) {
                                    console.warn('[shippingService] ME error from', origin.label, e);
                                }
                            })()
                        );
                    }

                    if (settings.frenet_enabled && settings.frenet_token) {
                        tasks.push(
                            (async () => {
                                try {
                                    const res = await fetch('/api/frenet-calculate', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            from_cep: origin.cep,
                                            to_cep: input.to_cep,
                                            weight_g: input.weight ?? 300,
                                            height_cm: input.height ?? 10,
                                            width_cm: input.width ?? 15,
                                            length_cm: input.length ?? 20,
                                            order_value: input.order_value ?? 0,
                                            token: settings.frenet_token,
                                        }),
                                    });
                                    if (!res.ok) return;
                                    const data = await res.json();
                                    const services: ShippingOption[] = (
                                        data.ShippingSevicesArray ??
                                        data.ShippingServicesArray ??
                                        data.ShippingServiceArray ??
                                        []
                                    )

                                        .filter((s: any) => !s.Error && parseFloat(s.ShippingPrice) > 0)
                                        .map((s: any) => ({
                                            id: `frenet_${s.ServiceCode}`,
                                            name: s.ServiceDescription,
                                            carrier: `${s.Carrier} (Frenet)`,
                                            price: parseFloat(s.ShippingPrice),
                                            isFree: false,
                                            estimatedDaysMin: s.DeliveryTime,
                                            estimatedDaysMax: s.DeliveryTime,
                                            daysLabel: `${s.DeliveryTime} dias úteis`,
                                            type: 'carrier' as const,
                                            origin_cep: origin.cep,
                                            origin_label: origin.label,
                                        }));
                                    originOptions.push(...services);
                                } catch (e: any) {
                                    console.warn('[shippingService] Frenet error from', origin.label, e);
                                }
                            })()
                        );
                    }

                    await Promise.allSettled(tasks);
                    return originOptions;
                })
            );

            // Combinar todos os resultados das origens
            for (const result of originResults) {
                if (result.status === 'fulfilled') {
                    options.push(...result.value);
                }
            }

            // Deduplicar: para cada nome, manter o mais barato (preserva origin do vencedor)
            const seen = new Map<string, ShippingOption>();
            for (const opt of options) {
                const key = opt.name.trim().toUpperCase();
                const existing = seen.get(key);
                if (!existing || opt.price < existing.price) {
                    seen.set(key, opt);
                }
            }
            options = Array.from(seen.values());
        }

        // ── Aplica Subsídio Progressivo Inteligente ──
        if (settings?.enable_progressive_shipping_subsidy && input.order_value !== undefined && input.order_cost !== undefined) {
            const orderTotal = input.order_value / 100;
            const orderCost = input.order_cost / 100;
            const orderProfit = Math.max(0, orderTotal - orderCost);
            
            const minOrder = settings.min_order_value_for_subsidy ?? 0;
            const discountPercent = settings.default_subsidy_discount_percent ?? 100;
            const profitCapPercent = settings.profit_margin_percentage_cap ?? 20;

            if (orderTotal >= minOrder && minOrder > 0) {
                const maxSubsidyFromProfit = orderProfit * (profitCapPercent / 100);

                options = options.map(c => {
                    const originalPrice = c.price;
                    const commercialDiscount = originalPrice * (discountPercent / 100);
                    // O subsídio real é o menor entre: o prêço do frete, o desconto comercial configurado, e o teto de segurança (lucro reservado)
                    const appliedSubsidy = Math.min(originalPrice, commercialDiscount, maxSubsidyFromProfit);
                    
                    if (appliedSubsidy > 0) {
                        return {
                            ...c,
                            originalPrice,
                            price: originalPrice - appliedSubsidy,
                            subsidy: appliedSubsidy,
                            isFree: (originalPrice - appliedSubsidy) <= 0
                        };
                    }
                    return c;
                });
            }
        }

        return {
            options: options.sort((a, b) => {
                if (a.isFree && !b.isFree) return -1;
                if (!a.isFree && b.isFree) return 1;
                return a.price - b.price;
            }),
            missingForFree
        };
    },
};
