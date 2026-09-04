import { vpsClient } from './vpsClient';
import { vpsApiService } from './vpsApiService';

export type SmartphoneSalePrices = { price_retail: number; price_reseller: number; price_wholesale: number };
export type SmartphonePriceGroup = {
    id: string; model_id: string; model_name: string; company_id: string | null;
    ram: string; storage: string; version: string; network: string; condition: string;
    revision: string; confirmed: boolean; divergent: boolean;
    prices: SmartphoneSalePrices | null; cost_min: number | null; cost_max: number | null;
    products: Array<SmartphoneSalePrices & { id: string; sku: string; name: string; color: string; stock_quantity: number; price_cost: number | null; unit_costs?: number[] }>;
};
export type SmartphonePriceReference = { controlled: boolean; prices?: SmartphoneSalePrices | null; divergent?: boolean; incomplete?: boolean; established?: boolean };
export const smartphonePriceGroups = {
    list: (modelId: string) => vpsClient.get<{ enabled: boolean; groups: SmartphonePriceGroup[]; unresolved: Array<{ id: string; sku: string; name: string }> }>(`/models/${encodeURIComponent(modelId)}/smartphone-price-groups`),
    reference: (modelId: string, product: object) => vpsClient.post<SmartphonePriceReference>(`/models/${encodeURIComponent(modelId)}/smartphone-price-reference`, product),
    save: async (group: SmartphonePriceGroup, prices: SmartphoneSalePrices) => {
        const result = await vpsClient.put<{ ok: boolean; updated: number }>(`/models/${encodeURIComponent(group.model_id)}/smartphone-price-groups/${group.id}`, { product_id: group.products[0].id, revision: group.revision, prices });
        vpsApiService.invalidateProductCache();
        return result;
    },
};
