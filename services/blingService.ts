import { supabase } from './supabase';

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';
const COMPANY_SLUG = 'mercado-do-vale';

// ------- Types -------

export interface BlingCategory {
    id: number;
    descricao: string;
}

export interface CategoryMapping {
    blingCategoryId: number;
    blingCategoryName: string;
    ourCategoryId: string;
    ourCategoryName: string;
}

const CATEGORY_MAPPING_KEY = 'bling_category_mappings';

export function loadCategoryMappings(): CategoryMapping[] {
    try { return JSON.parse(localStorage.getItem(CATEGORY_MAPPING_KEY) || '[]'); } catch { return []; }
}

export function saveCategoryMappings(mappings: CategoryMapping[]): void {
    localStorage.setItem(CATEGORY_MAPPING_KEY, JSON.stringify(mappings));
}

/** Resolve o category_id local a partir do objeto categoria do Bling */
export function resolveCategoryId(blingCategoryId: number | undefined, fallbackId: string): string {
    if (!blingCategoryId) return fallbackId;
    const mappings = loadCategoryMappings();
    const found = mappings.find(m => m.blingCategoryId === blingCategoryId);
    return found ? found.ourCategoryId : fallbackId;
}

export interface BlingProduct {
    id: number;
    nome: string;
    codigo: string | null;
    gtin: string | null;
    preco: number | null;
    precoCusto: number | null;
    situacao: string;
    stock_quantity: number;
    categoria?: { id: number; descricao: string };
    marca?: string;
    imagens?: Array<{ link?: string; url?: string }>;
}

/** Detalhes completos de um produto do Bling (retornados pelo endpoint individual) */
export interface BlingProductDetail extends BlingProduct {
    descricaoCurta?: string;
    descricaoComplementar?: string;
    ncm?: string;
    cest?: string;
    origem?: number;
    pesoBruto?: number;
    largura?: number;
    altura?: number;
    profundidade?: number;
    volumes?: number;
    itensPorCaixa?: number;
    unidade?: string;
    tipoProducao?: string;
    // Campos editáveis pelo admin antes do import
    _edited?: boolean;
}

/** Busca todos os campos de um produto Bling + estoque real por depósito */
export async function fetchBlingProductDetail(productId: number): Promise<BlingProductDetail | null> {
    try {
        const accessToken = await getValidToken();
        const res = await fetch(`/api/bling-product-detail?id=${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const trib = data.tributacao || {};
        const dim = data.dimensoes || {};
        return {
            id: data.id,
            nome: data.nome || '',
            codigo: data.codigo || null,
            gtin: data.gtin || null,
            preco: data.preco ?? null,
            precoCusto: data.precoCusto ?? null,
            situacao: data.situacao || 'A',
            stock_quantity: data.stock_quantity ?? 0,
            categoria: data.categoria || undefined,
            marca: data.marca || undefined,
            descricaoCurta: data.descricaoCurta || undefined,
            descricaoComplementar: data.descricaoComplementar || undefined,
            ncm: trib.ncm || undefined,
            cest: trib.cest || undefined,
            origem: trib.origem ?? undefined,
            pesoBruto: dim.pesoBruto ?? undefined,
            largura: dim.largura ?? undefined,
            altura: dim.altura ?? undefined,
            profundidade: dim.profundidade ?? undefined,
            volumes: dim.volumes ?? undefined,
            itensPorCaixa: dim.itensPorCaixa ?? undefined,
            unidade: dim.unidade || undefined,
            tipoProducao: data.tipoProducao || undefined,
            imagens: data.imagens || [],
        };
    } catch {
        return null;
    }
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
    { key: 'stock_quantity', blingField: 'estoques/saldos (saldoFisico)', localField: 'stock_quantity', label: 'Estoque (saldo físico)', group: 'fisico', required: false },
    // Mídia
    { key: 'images', blingField: 'imagens', localField: 'images', label: 'Imagens', group: 'midia', required: false },
];

export type FieldKey = typeof BLING_FIELD_MAPPINGS[number]['key'];

// Default: all fields enabled
export const DEFAULT_ENABLED_FIELDS: Set<string> = new Set(BLING_FIELD_MAPPINGS.map(f => f.key));

// ------- Campo-a-campo: mapeamento configurável -------

/** Par de mapeamento: campo Bling → campo do nosso banco */
export interface FieldMappingConfig {
    blingKey: string;         // chave interna do BLING_FIELD_MAPPINGS (ex: 'price_retail')
    blingField: string;       // nome do campo no Bling (ex: 'preco')
    blingLabel: string;       // rótulo legível (ex: 'Preço Venda')
    systemField: string;      // campo do banco que vai receber (ex: 'price_retail')
    enabled: boolean;         // se esse mapeamento está ativo
}

/** Campos disponíveis no nosso sistema que podem receber dados do Bling */
export const SYSTEM_FIELDS: Array<{ field: string; label: string; group: string }> = [
    // Básico
    { field: 'name', label: 'Nome do produto', group: 'Básico' },
    { field: 'sku', label: 'SKU / Código', group: 'Básico' },
    { field: 'ean', label: 'EAN / GTIN', group: 'Básico' },
    { field: 'description', label: 'Descrição', group: 'Básico' },
    { field: 'brand', label: 'Marca (texto)', group: 'Básico' },
    { field: 'status', label: 'Status', group: 'Básico' },
    // Preços
    { field: 'price_retail', label: 'Preço varejo', group: 'Preços' },
    { field: 'price_cost', label: 'Preço custo', group: 'Preços' },
    { field: 'price_reseller', label: 'Preço revenda', group: 'Preços' },
    { field: 'price_wholesale', label: 'Preço atacado', group: 'Preços' },
    // Fiscal
    { field: 'ncm', label: 'NCM', group: 'Fiscal' },
    { field: 'cest', label: 'CEST', group: 'Fiscal' },
    { field: 'origin', label: 'Origem', group: 'Fiscal' },
    // Físico
    { field: 'weight_kg', label: 'Peso bruto (kg)', group: 'Físico' },
    { field: 'stock_quantity', label: 'Estoque', group: 'Físico' },
    // Classificação
    { field: 'color_id', label: 'Cor (pelo nome)', group: 'Classificação' },
    // Mídia
    { field: 'images', label: 'Imagens', group: 'Mídia' },
];

const FIELD_MAPPING_KEY = 'bling_field_mappings';

/** Gera os mapeamentos padrão a partir de BLING_FIELD_MAPPINGS */
export function getDefaultFieldMappings(): FieldMappingConfig[] {
    return BLING_FIELD_MAPPINGS.map(f => ({
        blingKey: f.key,
        blingField: f.blingField,
        blingLabel: f.label,
        systemField: f.localField,
        enabled: true,
    }));
}

export function loadFieldMappings(): FieldMappingConfig[] {
    try {
        const saved = localStorage.getItem(FIELD_MAPPING_KEY);
        return saved ? JSON.parse(saved) : getDefaultFieldMappings();
    } catch { return getDefaultFieldMappings(); }
}

export function saveFieldMappings(mappings: FieldMappingConfig[]): void {
    localStorage.setItem(FIELD_MAPPING_KEY, JSON.stringify(mappings));
}

/**
 * Retorna um Map<blingKey, systemField> apenas para os mapeamentos habilitados.
 * Usado em mapBlingToDb para construir o row dinamicamente.
 */
export function getEffectiveMapping(): Map<string, string> {
    const map = new Map<string, string>();
    for (const m of loadFieldMappings()) {
        if (m.enabled && m.systemField) map.set(m.blingKey, m.systemField);
    }
    return map;
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

/** Busca todas as categorias de produtos do Bling */
export async function fetchBlingCategories(): Promise<BlingCategory[]> {
    const accessToken = await getValidToken();
    const all: BlingCategory[] = [];
    let page = 1;

    do {
        const res = await fetch(`/api/bling-categories?page=${page}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!res.ok) break;
        const json = await res.json();
        const items: any[] = json.data || [];
        if (items.length === 0) break;
        all.push(...items.map((c: any) => ({ id: c.id, descricao: c.descricao })));
        if (items.length < 100) break;
        page++;
    } while (true);

    return all;
}

/** Busca todos os saldos de estoque e retorna Map<productId, saldoFisico total> */
async function fetchStockMap(accessToken: string): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    let page = 1;

    do {
        const res = await fetch(`/api/bling-stock?page=${page}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!res.ok) break;

        const json = await res.json();
        const items: any[] = json.data || [];
        if (items.length === 0) break;

        for (const item of items) {
            const productId = item.produto?.id;
            if (!productId) continue;
            const qty = item.saldoFisico ?? 0;
            map.set(productId, (map.get(productId) || 0) + qty);
        }

        if (items.length < 100) break;
        page++;
    } while (true);

    return map;
}

// ------- Mapping: Bling → DB row -------

/** Monta o objeto de DB incluindo apenas os campos habilitados pelo admin */
function mapBlingToDb(item: any, companyId: string, enabledFields: Set<string>, categoryId: string): Record<string, any> {
    const has = (key: string) => enabledFields.has(key);

    // Campos sempre obrigatórios — defaults seguros para todos os NOT NULL do banco
    const row: Record<string, any> = {
        company_id: companyId,
        bling_id: item.id,
        category_id: resolveCategoryId(item.categoria?.id, categoryId),
        name: item.nome || 'Produto sem nome',
        brand: item.marca || null,   // marca do Bling mapeada para o campo string
        // Preços convertidos para centavos
        price_retail: item.preco ? Math.round(item.preco * 100) : 0,
        price_reseller: item.preco ? Math.round(item.preco * 100) : 0,
        price_wholesale: item.preco ? Math.round(item.preco * 100) : 0,
        price_cost: item.precoCusto ? Math.round(item.precoCusto * 100) : null,
        status: item.situacao === 'A' ? 'active' : 'inactive',
        specs: {},
        stock_quantity: item.stock_quantity ?? 0,
        track_inventory: true,
        is_gift: false,
        warranty_type: 'brand',
        alternative_eans: [],
    };

    // Campos opcionais controlados pelo admin
    if (has('sku')) row.sku = item.codigo || null;
    if (has('ean')) { row.ean = item.gtin || null; row.alternative_eans = item.gtin ? [item.gtin] : []; }
    if (has('description')) row.description = item.descricaoComplementar || item.descricaoCurta || null;

    // Preços sobrescritos pelo mapeamento (se habilitado, já foram incluídos nos defaults acima)
    // Aqui permitimos que o admin desabilite um preço (mas não podemos remover o default 0)

    if (has('ncm')) row.ncm = item.tributacao?.ncm || null;
    if (has('cest')) row.cest = item.tributacao?.cest || null;
    if (has('origin')) row.origin = item.tributacao?.origem != null ? String(item.tributacao.origem) : null;

    if (has('weight_kg')) row.weight_kg = item.dimensoes?.pesoBruto || null;
    if (has('dimensions')) {
        const d = item.dimensoes || {};
        row.dimensions = (d.largura || d.altura || d.profundidade)
            ? { width_cm: d.largura || null, height_cm: d.altura || null, depth_cm: d.profundidade || null }
            : null;
    }
    if (has('stock_quantity')) row.stock_quantity = item.stock_quantity ?? 0;

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

    // Busca produtos e saldos em paralelo
    const [, stockMap] = await Promise.all([
        Promise.resolve(),
        fetchStockMap(accessToken),
    ]);

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
            stock_quantity: stockMap.get(item.id) ?? 0,
            categoria: item.categoria || undefined,
            marca: item.marca || undefined,
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

    const [res, stockMap] = await Promise.all([
        fetch(`/api/bling-products?page=1&search=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetchStockMap(accessToken),
    ]);

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
        stock_quantity: stockMap.get(item.id) ?? 0,
        categoria: item.categoria || undefined,
        marca: item.marca || undefined,
        imagens: item.imagens || [],
    }));
}


export async function importBlingProducts(
    selectedProducts: BlingProduct[],
    enabledFields: Set<string>,
    categoryId: string,
    onProgress: (current: number, total: number, result: Partial<ImportResult>) => void
): Promise<ImportResult> {
    const companyId = await getCompanyId();

    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const total = selectedProducts.length;

    for (let i = 0; i < selectedProducts.length; i++) {
        const item = selectedProducts[i];
        let operation = 'verificação';
        try {
            const row = mapBlingToDb(item, companyId, enabledFields, categoryId);

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
