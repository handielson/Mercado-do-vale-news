const DEFAULT_MODEL_PAGE_SIZE = 1000;

type ModelRowsQuery = {
    select: (columns: string) => ModelRowsQuery;
    eq: (column: string, value: string) => ModelRowsQuery;
    order: (column: string, options?: Record<string, unknown>) => ModelRowsQuery;
    range: (from: number, to: number) => Promise<{ data: any[] | null; error: any }>;
};

type ModelRowsClient = {
    from: (table: string) => ModelRowsQuery;
};

interface FetchAllModelRowsOptions {
    companyId: string;
    brandId?: string;
    pageSize?: number;
}

export async function fetchAllModelRows(
    supabaseClient: ModelRowsClient,
    { companyId, brandId, pageSize = DEFAULT_MODEL_PAGE_SIZE }: FetchAllModelRowsOptions,
): Promise<any[]> {
    const rows: any[] = [];

    for (let from = 0; ; from += pageSize) {
        let query = supabaseClient
            .from('models')
            .select('*')
            .eq('company_id', companyId);

        if (brandId) {
            query = query.eq('brand_id', brandId);
        }

        const { data, error } = await query
            .order('name')
            .range(from, from + pageSize - 1);

        if (error) throw error;

        const page = data || [];
        rows.push(...page);

        if (page.length < pageSize) break;
    }

    return rows;
}
