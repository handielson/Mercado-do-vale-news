type ModelRowsClient = {
    get: <T = any>(path: string) => Promise<T>;
};

interface FetchAllModelRowsOptions {
    companyId: string;
    brandId?: string;
}

export async function fetchAllModelRows(
    vpsClient: ModelRowsClient,
    { companyId, brandId }: FetchAllModelRowsOptions,
): Promise<any[]> {
    const params = new URLSearchParams({ company_id: companyId });
    if (brandId) params.set('brand_id', brandId);
    const rows = await vpsClient.get<any[]>(`/models?${params.toString()}`);
    return Array.isArray(rows) ? rows : [];
}
