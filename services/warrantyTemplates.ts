import { WarrantyTemplate, WarrantyTemplateInput } from '../types/warranty';
import { getCompanyId } from './companyContext';
import { vpsClient } from './vpsClient';

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

async function loadWarrantyTemplates(pageSize = 200): Promise<WarrantyTemplate[]> {
    let offset = 0;
    const rows: WarrantyTemplate[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<WarrantyTemplate>>(
            `/table-data/warranty_templates?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

async function list(): Promise<WarrantyTemplate[]> {
    const companyId = await getCompanyId();
    return (await loadWarrantyTemplates())
        .filter(template => template.company_id === companyId)
        .sort((a, b) => a.name.localeCompare(b.name));
}

async function getById(id: string): Promise<WarrantyTemplate | null> {
    const companyId = await getCompanyId();
    const template = (await loadWarrantyTemplates())
        .find(item => item.id === id && item.company_id === companyId);

    return template || null;
}

async function create(input: WarrantyTemplateInput): Promise<WarrantyTemplate> {
    const companyId = await getCompanyId();

    return vpsClient.post<WarrantyTemplate>('/table-data/warranty_templates', {
        company_id: companyId,
        name: input.name,
        description: input.description,
        duration_days: input.duration_days,
        terms: input.terms,
        active: input.active ?? true,
    });
}

async function update(id: string, input: WarrantyTemplateInput): Promise<WarrantyTemplate> {
    return vpsClient.patch<WarrantyTemplate>(`/table-data/warranty_templates/${id}`, {
        name: input.name,
        description: input.description,
        duration_days: input.duration_days,
        terms: input.terms,
        active: input.active ?? true,
        updated_at: new Date().toISOString(),
    });
}

async function remove(id: string): Promise<void> {
    await vpsClient.delete(`/table-data/warranty_templates/${id}`);
}

export const warrantyTemplateService = {
    list,
    getById,
    create,
    update,
    remove
};
