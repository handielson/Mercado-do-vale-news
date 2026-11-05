import { useCallback, useEffect, useState } from 'react';
import { categoryService } from '../../services/categories';
import { colorService } from '../../services/colors';
import { modelColorImagesService } from '../../services/model-color-images';
import { stockLocationService } from '../../services/stockLocationService';
import { isSmartphoneModel } from '../../services/smartphoneModelSpecs.mjs';

export interface LocationRow { id: string; name: string; is_default?: boolean; is_active?: boolean }
export interface ModelRef { id: string; name: string; category_id?: string | null }

/** Custo e local digitados numa aba. */
export interface CostLocation { cost: number; locationId: string }
/** Estado guardado pela página: sobrevive à aba ser desmontada (ex.: troca de ?variacao=). */
export interface SharedCostLocation { value: CostLocation; onChange: (update: (current: CostLocation) => CostLocation) => void }
export const EMPTY_COST_LOCATION: CostLocation = { cost: 0, locationId: '' };

/** Custo e local da aba: na página quando ela passa `shared`, senão locais da própria aba. */
export function useCostLocation(shared?: SharedCostLocation) {
    const [local, setLocal] = useState<CostLocation>(EMPTY_COST_LOCATION);
    const value = shared ? shared.value : local;
    const update = shared ? shared.onChange : setLocal;
    const setCost = useCallback((cost: number) => update(c => (c.cost === cost ? c : { ...c, cost })), [update]);
    const setLocationId = useCallback((next: string | ((current: string) => string)) => update(c => {
        const locationId = typeof next === 'function' ? next(c.locationId) : next;
        return locationId === c.locationId ? c : { ...c, locationId };
    }), [update]);
    return { cost: value.cost, locationId: value.locationId, setCost, setLocationId };
}

/** Locais de estoque ativos; preenche o local padrão quando ainda não há escolha. */
export function useEntryLocations(setLocationId: (update: (current: string) => string) => void) {
    const [locations, setLocations] = useState<LocationRow[]>([]);
    const [locationsError, setLocationsError] = useState(false);
    useEffect(() => {
        let alive = true;
        stockLocationService.listLocations()
            .then(list => {
                if (!alive) return;
                const active = (list as LocationRow[]).filter(l => l.is_active !== false);
                setLocations(active);
                setLocationId(current => current || active.find(l => l.is_default)?.id || '');
            })
            .catch(() => { if (alive) setLocationsError(true); });
        return () => { alive = false; };
    }, []);
    return { locations, locationsError };
}

/**
 * Descobre se o modelo é celular e quais cores têm foto.
 * Lança erro se a categoria do modelo não puder ser identificada.
 */
export async function loadModelProfile(model: ModelRef): Promise<{ isPhone: boolean; colorOptions: string[] }> {
    const [category, rows, colors] = await Promise.all([
        model.category_id ? categoryService.getById(model.category_id).catch(() => undefined) : Promise.resolve(null),
        modelColorImagesService.getByModel(model.id).catch(() => []),
        colorService.list().catch(() => []),
    ]);
    if (model.category_id && !category) throw new Error('categoria');
    const names = new Map((colors as { id: string; name: string }[]).map(c => [c.id, c.name]));
    const withPhoto = (rows as { color_id: string; images?: string[]; image_url?: string | null }[])
        .filter(r => (r.images && r.images.length > 0) || r.image_url)
        .map(r => names.get(r.color_id))
        .filter((n): n is string => Boolean(n));
    return {
        isPhone: isSmartphoneModel({ category_name: (category as { name?: string } | null | undefined)?.name }),
        colorOptions: Array.from(new Set(withPhoto)),
    };
}
