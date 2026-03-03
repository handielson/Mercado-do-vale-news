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

export interface ImportErrorDetail {
    name: string;
    sku: string | null;
    reason: string;
}

export interface ImportResult {
    created: number;
    updated: number;
    errors: ImportErrorDetail[];
}

// ------- Field Mappings -------

export interface BlingFieldMapping {
    key: string;           // identificador interno
    blingField: string;    // campo(s) na API Bling (pode mostrar múltiplos)
    localField: string;    // campo na nossa tabela products
    label: string;         // nome amigável para o admin
    group: 'basico' | 'preco' | 'fiscal' | 'fisico' | 'midia';
    required: boolean;     // sempre importado, sem opção de desmarcar
}

export const BLING_FIELD_MAPPINGS: BlingFieldMapping[] = [
    // Básico
    { key: 'name', blingField: 'nome', localField: 'name', label: 'Nome do produto', group: 'basico', required: true },
    { key: 'sku', blingField: 'codigo', localField: 'sku', label: 'SKU / Código', group: 'basico', required: false },
    { key: 'ean', blingField: 'gtin', localField: 'ean', label: 'EAN / GTIN', group: 'basico', required: false },
    { key: 'description', blingField: 'descricaoComplementar', localField: 'description', label: 'Descrição complementar', group: 'basico', required: false },
    { key: 'status', blingField: 'situacao', localField: 'status', label: 'Status (ativo/inativo)', group: 'basico', required: false },
    // Preço
    { key: 'price_retail', blingField: 'preco', localField: 'price_retail', label: 'Preço de Venda (R$)', group: 'preco', required: false },
    { key: 'price_cost', blingField: 'precoCusto', localField: 'price_cost', label: 'Preço de Custo (R$)', group: 'preco', required: false },
    // Fiscal
    { key: 'ncm', blingField: 'ncm', localField: 'ncm', label: 'NCM', group: 'fiscal', required: false },
    { key: 'cest', blingField: 'cest', localField: 'cest', label: 'CEST', group: 'fiscal', required: false },
    { key: 'origin', blingField: 'origem', localField: 'origin', label: 'Origem (nacional/importado)', group: 'fiscal', required: false },
    // Físico
    { key: 'weight_kg', blingField: 'pesoBruto', localField: 'weight_kg', label: 'Peso bruto (kg)', group: 'fisico', required: false },
    { key: 'dimensions', blingField: 'largura / altura / profundidade', localField: 'dimensions', label: 'Dimensões (L×A×P cm)', group: 'fisico', required: false },
    // Mídia
    { key: 'images', blingField: 'imagens', localField: 'images', label: 'Imagens', group: 'midia', required: false },
];

export type FieldKey = typeof BLING_FIELD_MAPPINGS[number]['key'];

// Default: all fields enabled
export const DEFAULT_ENABLED_FIELDS: Set<string> = new Set(BLING_FIELD_MAPPINGS.map(f => f.key));

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
    // Usa proxy serverless para evitar CORS
    const res = await fetch(`/api/bling-products?page=${page}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    if (!res.ok) throw new Error(`Bling API error ${res.status}: ${await res.text()}`);

    const json = await res.json();
    return {
        items: json.data || [],
        total: json.total ?? (json.data?.length || 0),
    };
}

// ------- Mapping: Bling → DB row -------

/** Monta o objeto de DB incluindo apenas os campos habilitados pelo admin */
function mapBlingToDb(item: any, companyId: string, enabledFields: Set<string>): Record<string, any> {
    const has = (key: string) => enabledFields.has(key);

    // Campos sempre obrigatórios
    const row: Record<string, any> = {
        company_id: companyId,
        bling_id: item.id,
        name: item.nome || 'Produto sem nome',   // 'name' sempre incluído (required)
        specs: {},
        stock_quantity: 0,
        track_inventory: true,
        is_gift: false,
        warranty_type: 'brand',
    };

    if (has('sku')) row.sku = item.codigo || null;
    if (has('ean')) { row.ean = item.gtin || null; row.alternative_eans = item.gtin ? [item.gtin] : []; }
    if (has('description')) row.description = item.descricaoComplementar || item.descricaoCurta || null;
    if (has('status')) row.status = item.situacao === 'A' ? 'active' : 'inactive';

    if (has('price_retail')) row.price_retail = item.preco ? Math.round(item.preco * 100) : null;
    if (has('price_cost')) row.price_cost = item.precoCusto ? Math.round(item.precoCusto * 100) : null;

    if (has('ncm')) row.ncm = item.ncm || null;
    if (has('cest')) row.cest = item.cest || null;
    if (has('origin')) row.origin = item.origem != null ? String(item.origem) : null;

    if (has('weight_kg')) row.weight_kg = item.pesoBruto || null;
    if (has('dimensions')) {
        row.dimensions = (item.largura || item.altura || item.profundidade)
            ? { width_cm: item.largura || null, height_cm: item.altura || null, depth_cm: item.profundidade || null }
            : null;
    }

    if (has('images')) {
        const first = item.imagens?.[0]?.link || item.imagens?.[0]?.url || null;
        row.images = first ? [first] : [];
    }

    return row;
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

// ------- Search specific products in Bling -------

export async function searchBlingProducts(query: string): Promise<BlingProduct[]> {
    const accessToken = await getValidToken();

    const res = await fetch(`/api/bling-products?page=1&search=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) throw new Error(`Bling API error ${res.status}`);
    const json = await res.json();

    return (json.data || []).map((item: any) => ({
        id: item.id,
        nome: item.nome || 'Produto sem nome',
        codigo: item.codigo || null,
        gtin: item.gtin || null,
        preco: item.preco || null,
        precoCusto: item.precoCusto || null,
        situacao: item.situacao || 'A',
        imagens: item.imagens || [],
    }));
}


export async function importBlingProducts(
    selectedProducts: BlingProduct[],
    enabledFields: Set<string>,
    onProgress: (current: number, total: number, result: Partial<ImportResult>) => void
): Promise<ImportResult> {
    const companyId = await getCompanyId();

    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const total = selectedProducts.length;

    for (let i = 0; i < selectedProducts.length; i++) {
        const item = selectedProducts[i];
        let operation = 'verificação';
        try {
            const row = mapBlingToDb(item, companyId, enabledFields);

            operation = 'verificação de duplicata';
            const { data: existing, error: checkError } = await supabase
                .from('products')
                .select('id')
                .eq('company_id', companyId)
                .eq('bling_id', item.id)
                .maybeSingle();

            if (checkError) throw new Error(checkError.message);

            if (existing) {
                operation = 'atualização';
                // Remove campos que não devem ser sobrescritos em updates
                const { company_id, bling_id, specs, stock_quantity, track_inventory, is_gift, warranty_type, ...updateFields } = row;
                const { error } = await supabase
                    .from('products')
                    .update(updateFields)
                    .eq('id', existing.id);
                if (error) throw new Error(error.message);
                result.updated++;
            } else {
                operation = 'criação';
                const { error } = await supabase
                    .from('products')
                    .insert(row);
                if (error) throw new Error(error.message);
                result.created++;
            }
        } catch (err: any) {
            result.errors.push({
                name: item.nome,
                sku: item.codigo,
                reason: `Erro na ${operation}: ${err.message}`,
            });
        }

        onProgress(i + 1, total, result);
    }

    return result;
}

export const blingService = {
    getValidToken,
    fetchAllBlingProducts,
    searchBlingProducts,
    importBlingProducts,
};
export const blingService = {
    getValidToken,
    fetchAllBlingProducts,
    searchBlingProducts,
    importBlingProducts,
};
