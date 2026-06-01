import { vpsClient } from './vpsClient';

const COMPANY_SLUG = 'mercado-do-vale';
const DEFAULT_COMPANY_ID = '9717131e-7b14-4aec-84a4-4317c0489985';

interface TableDataResponse<T> {
    rows?: T[];
}

interface CompanyRow {
    id?: string;
    slug?: string | null;
}

let cachedCompanyId: string | null = null;
let inFlight: Promise<string> | null = null;

function useDefaultCompanyId(reason: unknown): string {
    console.warn('[companyContext] Using default VPS company id:', reason);
    cachedCompanyId = DEFAULT_COMPANY_ID;
    return DEFAULT_COMPANY_ID;
}

export async function getCompanyId(): Promise<string> {
    if (cachedCompanyId) return cachedCompanyId;
    if (inFlight) return inFlight;

    inFlight = (async () => {
        try {
            const pageSize = 100;
            for (let offset = 0; ; offset += pageSize) {
                const data = await vpsClient.get<TableDataResponse<CompanyRow>>(
                    `/table-data/companies?limit=${pageSize}&offset=${offset}`
                );
                const rows = Array.isArray(data.rows) ? data.rows : [];
                const company = rows.find(row => row.slug === COMPANY_SLUG);
                if (company?.id) {
                    cachedCompanyId = String(company.id);
                    return cachedCompanyId;
                }
                if (rows.length < pageSize) break;
            }
            return useDefaultCompanyId('company slug not found');
        } catch (error) {
            return useDefaultCompanyId(error);
        } finally {
            inFlight = null;
        }
    })();

    return inFlight;
}
