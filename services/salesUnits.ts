import { vpsClient } from './vpsClient';
import { SALES_UNIT_PREFERENCE_KEY, normalizeSalesUnit, salesUnitCatalog } from './salesUnitCatalog.js';

const path = `/admin/preferences/${SALES_UNIT_PREFERENCE_KEY}`;
export const salesUnitsService = {
    async list(): Promise<string[]> {
        const response = await vpsClient.get<{ value: string[] | null }>(path);
        return salesUnitCatalog(response.value);
    },
    async create(value: string): Promise<{ name: string; created: boolean; units: string[] }> {
        const name = normalizeSalesUnit(value);
        const units = await this.list();
        const created = !units.includes(name);
        const updated = salesUnitCatalog([...units, name]);
        if (updated.length > 500) throw new Error('Limite de 500 unidades atingido.');
        if (created) await vpsClient.patch(path, { value: updated });
        return { name, created, units: updated };
    },
};
