/**
 * Shipping System Types
 * Covers: global settings, delivery zones, price ranges, and calculation results
 */

export type ShippingZoneType = 'local_free' | 'local_paid' | 'national';

/** Configuração do badge de entrega expressa (ex: "Entrega em até 1h") */
export interface FastDeliveryConfig {
    enabled: boolean;
    cities: string[];          // ex: ['Petrolina', 'Juazeiro']
    message: string;           // ex: 'Entrega em até 1h para você! 🚀'
    badge_label: string;       // ex: 'Entrega em 1h'
}

export interface ShippingSettings {
    id: string;
    origin_cep: string;
    secondary_origin_cep?: string;
    secondary_origin_label?: string;  // ex: 'Juazeiro'
    origin_label?: string;            // ex: 'Petrolina'
    melhor_envio_token?: string;
    melhor_envio_sandbox: boolean;
    melhor_envio_enabled: boolean;
    melhor_envio_allowed_services?: string;
    frenet_token?: string;
    frenet_enabled: boolean;
    local_delivery_enabled: boolean;
    
    // Subsídio Progressivo de Frete
    enable_progressive_shipping_subsidy: boolean;
    min_order_value_for_subsidy: number;
    default_subsidy_discount_percent: number;
    profit_margin_percentage_cap: number;

    // Badge de Entrega Expressa
    fast_delivery_config?: FastDeliveryConfig;

    updated_at: string;
}

export interface ShippingSettingsInput {
    origin_cep: string;
    secondary_origin_cep?: string;
    secondary_origin_label?: string;
    origin_label?: string;
    melhor_envio_token?: string;
    melhor_envio_sandbox?: boolean;
    melhor_envio_enabled?: boolean;
    melhor_envio_allowed_services?: string;
    frenet_token?: string;
    frenet_enabled?: boolean;
    local_delivery_enabled?: boolean;
    
    // Subsídio Progressivo de Frete
    enable_progressive_shipping_subsidy?: boolean;
    min_order_value_for_subsidy?: number;
    default_subsidy_discount_percent?: number;
    profit_margin_percentage_cap?: number;

    // Badge de Entrega Expressa
    fast_delivery_config?: FastDeliveryConfig;
}

export interface ShippingZone {
    id: string;
    name: string;
    type: ShippingZoneType;
    enabled: boolean;
    cities: string[];
    cep_ranges: string[];
    max_km_free?: number;
    price_per_km?: number;
    fixed_price?: number;
    min_order_free?: number;
    estimated_days_min: number;
    estimated_days_max: number;
    display_order: number;
    created_at: string;
    price_ranges?: ShippingPriceRange[];
}

export interface ShippingZoneInput {
    name: string;
    type: ShippingZoneType;
    enabled?: boolean;
    cities?: string[];
    cep_ranges?: string[];
    max_km_free?: number | null;
    price_per_km?: number | null;
    fixed_price?: number | null;
    min_order_free?: number | null;
    estimated_days_min?: number;
    estimated_days_max?: number;
    display_order?: number;
}

export interface ShippingPriceRange {
    id: string;
    zone_id: string;
    label: string;
    min_km: number;
    max_km?: number;                // null = sem limite superior
    price: number;
    estimated_days_min: number;
    estimated_days_max: number;
}

export interface ShippingPriceRangeInput {
    zone_id: string;
    label: string;
    min_km: number;
    max_km?: number;
    price: number;
    estimated_days_min?: number;
    estimated_days_max?: number;
}

// Result returned to the catalog when calculating shipping
export interface ShippingOption {
    id: string;                     // zone_id or carrier code
    name: string;                   // "Entrega Local", "SEDEX", "PAC"
    carrier?: string;               // "Melhor Envio", "Correios", "Jadlog"
    price: number;                  // 0 = free
    isFree: boolean;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    daysLabel: string;              // "Hoje", "1 dia útil", "2-4 dias úteis"
    type: ShippingZoneType | 'carrier';
    origin_cep?: string;            // CEP do depósito de origem
    origin_label?: string;          // "Petrolina" | "Juazeiro"
    subsidy?: number;               // Subsídio aplicado (se houver)
    originalPrice?: number;         // Preço original (se houver subsídio)
}

export interface ShippingCalculationInput {
    to_cep: string;
    weight?: number;                // gramas
    height?: number;                // cm
    width?: number;                 // cm
    length?: number;                // cm
    order_value?: number;           // para verificar min_order_free (em centavos)
    order_cost?: number;            // custo total dos produtos para cálculo de margem do subsídio (em centavos)
}

export interface ShippingCalculationResult {
    options: ShippingOption[];
    missingForFree?: number;
}
