import { supabase } from './supabase';

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';
const COMPANY_SLUG = 'mercado-do-vale';

// ------- Types -------

export interface BlingProduct {
    id: number;
    nome: string;
    codigo: string | null;
    gtin: string | null;
    preco: number | null;
    precoCusto: number | null;
    situacao: string;
    imagens?: Array<{ link?: string; url?: string }>;
}

export interface ImportResult {
    created: number;
    updated: number;
    errors: string[];
}

interface BlingTokenData {
    id: string;
    bling_access_token: string;
    bling_refresh_token: string | null;
    bling_client_id: string;
    bling_client_secret: string;
    bling_token_expires_at: string | null;
}

// ------- Internal: get company_id -------

async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', COMPANY_SLUG)
        .single();
    if (error || !data) throw new Error('Empresa não encontrada.');
    return data.id;
}

// ------- Token management -------

async function getValidToken(): Promise<string> {
    const { data, error } = await supabase
        .from('company_settings')
        .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
        .limit(1)
        .maybeSingle();

    if (error || !data?.bling_access_token) {
        throw new Error('Bling não está conectado. Acesse Configurações → Bling e clique em "Conectar".');
    }

    // Check if token is still valid (with 5min buffer)
    if (data.bling_token_expires_at) {
        const expiresAt = new Date(data.bling_token_expires_at).getTime();
        const now = Date.now() + 5 * 60 * 1000; // 5 min buffer
        if (expiresAt <= now && data.bling_refresh_token) {
            return refreshToken(data as BlingTokenData);
        }
    }

    return data.bling_access_token;
}

async function refreshToken(tokenData: BlingTokenData): Promise<string> {
    const res = await fetch('/api/bling-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: tokenData.bling_refresh_token,
            client_id: tokenData.bling_client_id,
            client_secret: tokenData.bling_client_secret,
            redirect_uri: 'refresh', // Signal for refresh_token grant
            grant_type: 'refresh_token',
        }),
    });

    if (!res.ok) throw new Error('Erro ao renovar token do Bling. Reconecte manualmente.');

    const tokens = await res.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    await supabase
        .from('company_settings')
        .update({
            bling_access_token: tokens.access_token,
            bling_refresh_token: tokens.refresh_token || tokenData.bling_refresh_token,
            bling_token_expires_at: expiresAt,
        })
        .eq('id', tokenData.id);

    return tokens.access_token;
}

// ------- Bling API calls -------

async function blingGet(path: string, accessToken: string): Promise<any> {
    const res = await fetch(`${BLING_API_BASE}${path}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
        },
    });

    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    if (!res.ok) throw new Error(`Bling API error ${res.status}: ${await res.text()}`);

    return res.json();
}

async function fetchProductsPage(accessToken: string, page: number): Promise<{ items: any[]; total: number }> {
    // criterio=5 = todos os produtos (ativos e inativos)
    const json = await blingGet(`/produtos?pagina=${page}&limite=100&criterio=5`, accessToken);
    return {
        items: json.data || [],
        total: json.total ?? (json.data?.length || 0),
    };
}

// ------- Mapping: Bling → DB row -------

function mapBlingToDb(item: any, companyId: string): Record<string, any> {
    const status = item.situacao === 'A' ? 'active' : 'inactive';

    const dimensions = (item.largura || item.altura || item.profundidade)
        ? {
            width_cm: item.largura || null,
            height_cm: item.altura || null,
            depth_cm: item.profundidade || null,
        }
        : null;

    const firstImage = item.imagens?.[0]?.link || item.imagens?.[0]?.url || null;
    const images = firstImage ? [firstImage] : [];

    const priceRetail = item.preco ? Math.round(item.preco * 100) : null;
    const priceCost = item.precoCusto ? Math.round(item.precoCusto * 100) : null;

    return {
        company_id: companyId,
        bling_id: item.id,
        name: item.nome || 'Produto sem nome',
        sku: item.codigo || null,
        ean: item.gtin || null,
        alternative_eans: item.gtin ? [item.gtin] : [],
        description: item.descricaoComplementar || item.descricaoCurta || null,
        price_retail: priceRetail,
        price_cost: priceCost,
        ncm: item.ncm || null,
        cest: item.cest || null,
        weight_kg: item.pesoBruto || null,
        dimensions,
        images,
        status,
        specs: {},
        stock_quantity: 0,
        track_inventory: true,
        is_gift: false,
        warranty_type: 'brand',
    };
}

// ------- Fetch all products (for selection UI) -------

export async function fetchAllBlingProducts(): Promise<BlingProduct[]> {
    const accessToken = await getValidToken();
    const all: BlingProduct[] = [];
    let page = 1;

    do {
        const { items } = await fetchProductsPage(accessToken, page);
        if (items.length === 0) break;
        all.push(...items.map((item: any) => ({
            id: item.id,
            nome: item.nome || 'Produto sem nome',
            codigo: item.codigo || null,
            gtin: item.gtin || null,
            preco: item.preco || null,
            precoCusto: item.precoCusto || null,
            situacao: item.situacao || 'A',
            imagens: item.imagens || [],
        })));
        if (items.length < 100) break;
        page++;
    } while (true);

    return all;
}

// ------- Import selected products -------

export async function importBlingProducts(
    selectedProducts: BlingProduct[],
    onProgress: (current: number, total: number, result: Partial<ImportResult>) => void
): Promise<ImportResult> {
    const accessToken = await getValidToken();
    const companyId = await getCompanyId();

    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const total = selectedProducts.length;

    for (let i = 0; i < selectedProducts.length; i++) {
        const item = selectedProducts[i];
        try {
            const row = mapBlingToDb(item, companyId);

            const { data: existing } = await supabase
                .from('products')
                .select('id')
                .eq('company_id', companyId)
                .eq('bling_id', item.id)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('products')
                    .update({
                        name: row.name,
                        sku: row.sku,
                        ean: row.ean,
                        alternative_eans: row.alternative_eans,
                        description: row.description,
                        price_retail: row.price_retail,
                        price_cost: row.price_cost,
                        ncm: row.ncm,
                        cest: row.cest,
                        weight_kg: row.weight_kg,
                        dimensions: row.dimensions,
                        images: row.images,
                        status: row.status,
                    })
                    .eq('id', existing.id);

                if (error) throw new Error(error.message);
                result.updated++;
            } else {
                const { error } = await supabase
                    .from('products')
                    .insert(row);

                if (error) throw new Error(error.message);
                result.created++;
            }
        } catch (err: any) {
            result.errors.push(`[${item.nome}]: ${err.message}`);
        }

        onProgress(i + 1, total, result);
    }

    return result;
}

export const blingService = {
    getValidToken,
    fetchAllBlingProducts,
    importBlingProducts,
};
