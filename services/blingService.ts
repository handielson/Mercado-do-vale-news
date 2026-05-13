import { supabase } from './supabase';
import { modelColorImagesService } from './model-color-images';
import { modelService } from './models';
import { brandService } from './brands';
import { crossSellTagsService } from './cross-sell-tags';
import { vpsApiService } from './vpsApiService';
import { buildVpsUrl, getVpsSyncHeaders, VPS_DIRECT_BASE_URL } from './vpsProxyBase';
import { ensureTag, parseTagsVenda } from '../utils/cross-sell-tags';

const BLING_API_BASE = 'https://api.bling.com.br/Api/v3';
const COMPANY_SLUG = 'mercado-do-vale';
const parentDetailCache = new Map<number, any>();

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

export interface ColorMapping {
    blingColorName: string;   // ex: "Vermelho" (extraído de variacao.nome)
    systemColorId: string;    // id da cor no sistema
    systemColorName: string;  // nome da cor no sistema (para exibição)
}

const COLOR_MAPPING_KEY = 'bling_color_mappings';

export function loadColorMappings(): ColorMapping[] {
    try {
        const saved = localStorage.getItem(COLOR_MAPPING_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

export function saveColorMappings(mappings: ColorMapping[]): void {
    localStorage.setItem(COLOR_MAPPING_KEY, JSON.stringify(mappings));
}

function resolveColorId(blingColorName: string | undefined): string | null {
    if (!blingColorName) return null;
    const mappings = loadColorMappings();
    const found = mappings.find(m =>
        m.blingColorName.toLowerCase() === blingColorName.toLowerCase()
    );
    return found?.systemColorId || null;
}


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
    // Se houver mapeamento sem categoria definida, usa a categoria padrão selecionada.
    const resolved = found?.ourCategoryId ? found.ourCategoryId : fallbackId;
    console.warn('[bling:category-map]', {
        blingCategoryId,
        mappedCategoryId: found?.ourCategoryId || null,
        mappedCategoryName: found?.ourCategoryName || null,
        fallbackCategoryId: fallbackId,
        resolvedCategoryId: resolved,
    });
    return resolved;
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
    variacao?: { nome: string; produtoPai?: { id: number } };
    formato?: string; // 'S' para Simples, 'E' para Estrutura/Pai
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
    _precoRevenda?: number;
    _precoAtacado?: number;
    nomePai?: string;
}

/** Busca todos os campos de um produto Bling + estoque real por depósito */
export async function fetchBlingProductDetail(productId: number): Promise<BlingProductDetail | null> {
    try {
        const accessToken = await getValidToken();
        const fetchWith429Retry = async (url: string, init: RequestInit, maxAttempts = 4): Promise<Response> => {
            let lastRes: Response | null = null;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const res = await fetch(url, init);
                if (res.status !== 429) return res;
                lastRes = res;
                // Exponential backoff leve para respeitar limite do Bling
                const retryAfterHeader = Number(res.headers.get('retry-after') || 0);
                const waitMs = retryAfterHeader > 0 ? retryAfterHeader * 1000 : 500 * attempt;
                await new Promise(resolve => setTimeout(resolve, waitMs));
            }
            return lastRes as Response;
        };

        const res = await fetchWith429Retry(`/api/bling?resource=product-detail&id=${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        const data = await res.json();

        // Se for variação, busca o pai para herdar campos que o Bling só retorna no pai
        const parentId: number | undefined = data.variacao?.produtoPai?.id;
        let parentData: any = null;
        if (parentId) {
            const cachedParent = parentDetailCache.get(parentId);
            if (cachedParent) {
                parentData = cachedParent;
            } else {
                const parentRes = await fetchWith429Retry(`/api/bling?resource=product-detail&id=${parentId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (parentRes.ok) {
                    parentData = await parentRes.json();
                    parentDetailCache.set(parentId, parentData);
                }
            }
        }

        // Merge field-by-field: filho tem prioridade, pai preenche os nulos
        // Evita o bug de objeto vazio {} (truthy) bloqueando o fallback
        const childTrib = data.tributacao || {};
        const parentTrib = parentData?.tributacao || {};
        const trib = {
            ncm: childTrib.ncm ?? parentTrib.ncm,
            cest: childTrib.cest ?? parentTrib.cest,
            origem: childTrib.origem ?? parentTrib.origem,
        };

        const childDim = data.dimensoes || {};
        const parentDim = parentData?.dimensoes || {};

        // pesoBruto pode estar no nível raiz do produto (não dentro de dimensoes)
        // na API Bling v3 — verificamos ambos os lugares
        const dim = {
            pesoBruto: childDim.pesoBruto || parentDim.pesoBruto
                || data.pesoBruto || parentData?.pesoBruto,
            largura: childDim.largura || parentDim.largura,
            altura: childDim.altura || parentDim.altura,
            profundidade: childDim.profundidade || parentDim.profundidade,
            volumes: childDim.volumes ?? parentDim.volumes,
            itensPorCaixa: childDim.itensPorCaixa ?? parentDim.itensPorCaixa,
            unidade: childDim.unidade || parentDim.unidade,
        };


        // Imagens: resolução a partir de midia.imagens.internas (estrutura real do Bling API v3)
        // Filho > Pai (ambos usam data.midia.imagens.internas)
        const extractImagens = (d: any): any[] => {
            const internas = d?.midia?.imagens?.internas || [];
            const externas = d?.midia?.imagens?.externas || d?.midia?.imagens?.imagensURL || [];
            return [...internas, ...externas];
        };

        let imagens: any[] = extractImagens(data);
        if (!imagens.length) imagens = extractImagens(parentData);
        if (!imagens.length && parentId) {
            try {
                const varRes = await fetch(`/api/bling?resource=product-detail&id=${parentId}&variacoes=1`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                if (varRes.ok) {
                    const varData = await varRes.json();
                    const variationsList = Array.isArray(varData) ? varData : varData.data || [];
                    const specificVar = variationsList.find((v: any) => v.id === data.id);
                    if (specificVar) imagens = extractImagens(specificVar);
                }
            } catch (err) {
                console.error('[Bling API] Error fetching variation image fallback:', err);
            }
        }

        const variacaoNomeDetalhe = data.variacao?.nome;

        return {

            id: data.id,
            nome: data.nome || '',
            nomePai: parentData?.nome || undefined,
            codigo: data.codigo || null,
            gtin: data.gtin || parentData?.gtin || null,
            preco: data.preco ?? parentData?.preco ?? null,
            precoCusto: data.precoCusto ?? parentData?.precoCusto ?? null,
            situacao: data.situacao || 'A',
            stock_quantity: data.stock_quantity ?? 0,
            categoria: data.categoria || parentData?.categoria || undefined,
            marca: data.marca || parentData?.marca || undefined,
            descricaoCurta: data.descricaoCurta || parentData?.descricaoCurta || undefined,
            descricaoComplementar: data.descricaoComplementar || parentData?.descricaoComplementar || undefined,
            ncm: trib.ncm ?? undefined,
            cest: trib.cest ?? undefined,
            origem: trib.origem ?? undefined,
            pesoBruto: dim.pesoBruto ?? undefined,
            largura: dim.largura ?? undefined,
            altura: dim.altura ?? undefined,
            profundidade: dim.profundidade ?? undefined,
            volumes: dim.volumes ?? undefined,
            itensPorCaixa: dim.itensPorCaixa ?? undefined,
            unidade: dim.unidade ?? undefined,
            tipoProducao: data.tipoProducao || undefined,
            imagens,
            variacao: data.variacao,
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

export async function getValidToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
    const { data, error } = await supabase
        .from('company_settings')
        .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
        .limit(1)
        .maybeSingle();

    if (error || !data?.bling_access_token) {
        throw new Error('Bling não está conectado. Acesse Configurações → Bling e clique em "Conectar".');
    }

    if (options.forceRefresh && data.bling_refresh_token) {
        return refreshToken(data as BlingTokenData);
    }

    // Check if token is still valid (with 5min buffer)
    if (data.bling_token_expires_at) {
        const expiresAt = new Date(data.bling_token_expires_at).getTime();
        const now = Date.now() + 5 * 60 * 1000; // 5 min buffer
        if (expiresAt <= now && data.bling_refresh_token) {
            try {
                return await refreshToken(data as BlingTokenData);
            } catch (err) {
                console.warn('[bling] refresh token failed, keeping current access token', err);
            }
        }
    }

    return data.bling_access_token;
}

async function refreshToken(tokenData: BlingTokenData): Promise<string> {
    const res = await fetch('/api/bling?resource=exchange', {
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
    const res = await fetch(`/api/bling?resource=products&page=${page}`, {
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
        const res = await fetch(`/api/bling?resource=categories&page=${page}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        
        // Rate limit protection (Bling allows max 3 requests per second)
        await new Promise(resolve => setTimeout(resolve, 350));
        
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
async function fetchStockMap(accessToken: string, productIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!productIds || productIds.length === 0) return map;

    // chunk requests into batches of 50 to avoid URL length issues
    const chunkSize = 50;
    for (let i = 0; i < productIds.length; i += chunkSize) {
        const chunk = productIds.slice(i, i + chunkSize);
        const queryParams = chunk.map(id => `idsProdutos[]=${id}`).join('&');

        const res = await fetch(`/api/bling?resource=stock&${queryParams}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 350));

        if (!res.ok) continue;

        const json = await res.json();
        const items: any[] = json.data || [];

        for (const item of items) {
            const productId = item.produto?.id;
            if (!productId) continue;
            // A API do Bling pode retornar o saldo de várias formas dependendo da versão
            const qty = item.saldoFisicoTotal ?? item.saldoFisico ?? item.saldoVirtualTotal ?? item.saldoVirtual ?? 0;
            map.set(productId, (map.get(productId) || 0) + qty);
        }
    }

    return map;
}

// ------- Helpers de variação -------

/** Mapeia chaves PT do Bling para inglês usado no sistema */
const VARIACAO_KEY_MAP: Record<string, string> = {
    cor: 'color', cores: 'color',
    tamanho: 'size', tam: 'size',
    capacidade: 'capacity', armazenamento: 'storage',
    voltagem: 'voltage', material: 'material',
};

/** Parseia "COR:ROSA;TAMANHO:G" → { color: "ROSA", size: "G" } */
function parseVariacaoAtributos(variacaoNome?: string): Record<string, string> {
    if (!variacaoNome) return {};
    const result: Record<string, string> = {};
    for (const part of variacaoNome.split(';')) {
        const colonIdx = part.indexOf(':');
        if (colonIdx > 0) {
            const rawKey = part.substring(0, colonIdx).trim().toLowerCase();
            const value = part.substring(colonIdx + 1).trim();
            const key = VARIACAO_KEY_MAP[rawKey] ?? rawKey;
            if (key && value) result[key] = value;
        }
    }
    return result;
}

/** Remove sufixos de variação do nome do produto.
 *  Exemplos: "Capa Cor:Vinho" → "Capa",
 *             "Redmi Note 15 - Rosa COR:ROSA" → "Redmi Note 15"
 */
function cleanVariacaoNome(nome: string, variacaoNome?: string): string {
    if (!variacaoNome) return nome;
    // Remove tudo a partir da primeira chave do variacaoNome no nome (case-insensitive)
    const firstKey = variacaoNome.split(';')[0].split(':')[0].trim();
    const regex = new RegExp(`[\\s,\\-]*${firstKey}:.*$`, 'i');
    return nome.replace(regex, '').trim();
}

/**
 * Fallback: extrai padrões CHAVE:VALOR do próprio nome do produto
 * quando variacao.nome não é retornado pela API Bling.
 * Ex: "Capa de silicone Cor:Preto" → "Cor:Preto"
 * Usa \b (word boundary) para não dar match em substrings (ex: "decor")
 */
function extractVariacaoFromName(nome: string): string | undefined {
    const knownKeys = Object.keys(VARIACAO_KEY_MAP).join('|');
    // \b garante que "cor" não vai dar match dentro de "decoração", etc.
    const regex = new RegExp(`\\b((?:${knownKeys}):[^;\\s][^;]*)`, 'i');
    const match = nome.match(regex);
    return match ? match[1].trim() : undefined;
}

// ------- Mapping: Bling → DB row -------

/** Mapeia TODOS os campos disponíveis do Bling para o banco — sem condicional.
 *  O campo `_color_id` é auxiliar (não vai para a tabela products).
 */
function mapBlingToDb(item: any, companyId: string, _enabledFields: Set<string>, categoryId: string, modelId?: string, marginWholesale: number = 0, marginReseller: number = 0, modelDescription?: string | null): Record<string, any> {
    // variacaoNome vem da API quando o produto é uma variação explícita;
    // se não vier, tenta extrair padrões CHAVE:VALOR do próprio nome
    const variacaoNome: string | undefined =
        item.variacao?.nome || extractVariacaoFromName(item.nome || '');
    const parentId: number | undefined = item.variacao?.produtoPai?.id;

    console.log('[mapBlingToDb] nome bruto:', item.nome);
    console.log('[mapBlingToDb] variacao?.nome da API:', item.variacao?.nome);
    console.log('[mapBlingToDb] variacaoNome resolvido:', variacaoNome);

    const nomeLimpo = cleanVariacaoNome(item.nome || 'Produto sem nome', variacaoNome);
    const specs = variacaoNome ? parseVariacaoAtributos(variacaoNome) : {};

    console.log('[mapBlingToDb] nomeLimpo:', nomeLimpo);
    console.log('[mapBlingToDb] specs:', specs);

    const dim = item.dimensoes || {};
    const trib = item.tributacao || {};
    const imagens = item.midia?.imagens?.internas || item.imagens || [];
    const firstImg = imagens[0]?.link || imagens[0]?.url || (typeof imagens[0] === 'string' ? imagens[0] : null);
    const slug = (nomeLimpo || item.codigo || item.id || 'produto')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-{2,}/g, '-');

    // pesoBruto pode estar no root do item (não dentro de dimensoes) — API Bling v3
    const pesoBruto = dim.pesoBruto || item.pesoBruto || null;
    const largura = dim.largura || null;
    const altura = dim.altura || null;
    const profundidade = dim.profundidade || null;

    const basePrice = item.preco ? Math.round(item.preco * 100) : 0;
    const wholesalePrice = item._precoAtacado ? Math.round(item._precoAtacado * 100) : (marginWholesale > 0 ? Math.round(basePrice * (1 - (marginWholesale / 100))) : basePrice);
    const resellerPrice = item._precoRevenda ? Math.round(item._precoRevenda * 100) : (marginReseller > 0 ? Math.round(basePrice * (1 - (marginReseller / 100))) : basePrice);

    return {
        // Identificação
        company_id: companyId,
        bling_id: item.id,
        bling_parent_id: parentId ?? null,
        // Básico
        name: nomeLimpo,
        slug,
        sku: item.codigo && !['PCS', 'UN', 'PC', 'CX'].includes(item.codigo.toUpperCase()) ? item.codigo : null,
        ean: item.gtin || null,
        alternative_eans: item.gtin ? [item.gtin] : [],
        brand: typeof item.marca === 'object' ? item.marca?.nome || null : item.marca || null,
        description: item.descricao || item.descricaoComplementar || item.descricaoCurta || modelDescription || null,
        status: item.situacao === 'A' ? 'active' : 'inactive',
        // Categoria
        category_id: resolveCategoryId(item.categoria?.id, categoryId),
        // Preços (em centavos)
        price_retail: basePrice,
        price_reseller: resellerPrice,
        price_wholesale: wholesalePrice,
        price_cost: item.precoCusto ? Math.round(item.precoCusto * 100) : null,
        // Fiscal
        ncm: trib.ncm || null,
        cest: trib.cest || null,
        origin: trib.origem != null ? String(trib.origem) : null,
        // Físico
        weight_kg: pesoBruto,
        dimensions: (largura || altura || profundidade)
            ? { width_cm: largura, height_cm: altura, depth_cm: profundidade }
            : null,
        // Estoque
        stock_quantity: item.stock_quantity ?? 0,
        track_inventory: true,
        // Cor mapeada — armazenada em _color_id (auxiliar, não vai para products)
        _color_id: resolveColorId(variacaoNome ? variacaoNome.split(';').find((p: string) => p.toLowerCase().startsWith('cor'))?.split(':')[1]?.trim() : undefined) || null,
        // Specs (variação: color, size...) + auto-tag da marca para cross-sell
        specs: (() => {
            const brandValue = typeof item.marca === 'object' ? item.marca?.nome || null : item.marca || null;
            if (!brandValue) return specs;
            return {
                ...specs,
                tags_venda: ensureTag(parseTagsVenda((specs as any).tags_venda), brandValue),
            } as any;
        })(),
        // Mídia
        images: imagens
            .slice(0, 5)
            .map((img: any) => img?.link || img?.url || (typeof img === 'string' ? img : null))
            .filter(Boolean),
        image_url: firstImg,
        // Modelo padrão (quando selecionado na importação)
        ...(modelId ? { model_id: modelId } : {}),
        // Defaults
        is_gift: false,
        warranty_type: 'brand',
    };
}

// ------- Stock sync: PDV → Bling -------

/**
 * Deduz estoque de um produto no Bling após uma venda no PDV.
 * Fire-and-forget: erros do Bling não bloqueiam a venda.
 */
export async function syncStockToBling(productId: string, quantity: number, notes?: string): Promise<void> {
    try {
        // Busca o bling_id do produto no banco
        const { supabase } = await import('./supabase');
        const { data: product } = await supabase
            .from('products')
            .select('bling_id, is_combo')
            .eq('id', productId)
            .maybeSingle();

        if (product?.is_combo) {
            const { vpsApiService } = await import('./vpsApiService');
            try {
                const children = await vpsApiService.getComboChildren(productId);
                if (children && children.length > 0) {
                    for (const child of children) {
                        // Deduz o estoque proporcionalmente para cada item (recursivo)
                        await syncStockToBling(child.child_id, quantity * child.quantity, `${notes || ''} (Combo)`.trim());
                    }
                }
            } catch (comboErr) {
                console.warn(`[syncStockToBling] Falha ao buscar filhos do combo ${productId}:`, comboErr);
            }
            return; // Combos não possuem estoque direto no Bling
        }

        const blingId = product?.bling_id;
        if (!blingId) return; // Produto não veio do Bling — ignora

        // Chama o proxy server-side (CORS-safe)
        await fetch('/api/bling?resource=stock-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blingId, quantity, notes }),
        });
    } catch (err) {
        // Não propaga o erro — a venda não deve falhar por problema no Bling
        console.warn('[syncStockToBling] Falha ao sincronizar estoque:', err);
    }
}



// ------- Fetch all products (for selection UI) -------

export type FetchProgress =
    | { phase: 'fetching_products'; newItems: BlingProduct[]; totalSoFar: number }
    | { phase: 'fetching_stock'; totalSoFar: number }
    | { phase: 'done'; totalSoFar: number };

export async function fetchAllBlingProducts(onProgress?: (p: FetchProgress) => void): Promise<BlingProduct[]> {
    const accessToken = await getValidToken();
    const all: BlingProduct[] = [];
    let page = 1;

    // O estoque será buscado *depois* que os produtos forem carregados

    do {
        const { items } = await fetchProductsPage(accessToken, page);

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 350));

        if (items.length === 0) break;
        const mapped: BlingProduct[] = items.map((item: any) => ({
            id: item.id,
            nome: item.nome || 'Produto sem nome',
            codigo: item.codigo || null,
            gtin: item.gtin || null,
            preco: item.preco || null,
            precoCusto: item.precoCusto || null,
            situacao: item.situacao || 'A',
            stock_quantity: 0, // Será preenchido abaixo
            categoria: item.categoria || undefined,
            marca: item.marca || undefined,
            imagens: item.imagens || [],
            variacao: item.variacao || undefined,
            formato: item.formato, // Necessário para exibir Produto Pai corretamente
        }));
        all.push(...mapped);
        onProgress?.({ phase: 'fetching_products', newItems: mapped, totalSoFar: all.length });
        if (items.length < 100) break;
        page++;
    } while (true);

    // Busca os estoques (Bling v3 exige passar idsProdutos[])
    onProgress?.({ phase: 'fetching_stock', totalSoFar: all.length });
    const productIds = all.map(p => p.id);
    const stockMap = await fetchStockMap(accessToken, productIds);

    for (const p of all) {
        p.stock_quantity = stockMap.get(p.id) ?? 0;
    }

    // A API do Bling não retorna `formato` na listagem paginada.
    // Identificamos os Produtos Pai como aqueles cujo ID aparece como
    // variacao.produtoPai.id em algum filho da mesma listagem.
    const parentIds = new Set<number>();
    for (const p of all) {
        const paiId = (p.variacao as any)?.produtoPai?.id;
        if (paiId) parentIds.add(paiId);
    }
    for (const p of all) {
        if (!p.formato && parentIds.has(p.id)) {
            p.formato = 'E';
        }
    }

    onProgress?.({ phase: 'done', totalSoFar: all.length });
    return all;
}

// ------- Search specific products in Bling -------

export async function checkExistingBlingProducts(blingIds: number[]): Promise<Set<number>> {
    if (blingIds.length === 0) return new Set();

    // Fonte da verdade: VPS (mesma fonte da listagem /admin/products).
    // Antes consultava Supabase, mas produtos podiam existir lá sem ter sincronizado com a VPS,
    // gerando falso-positivo "já importado" que bloqueava reimportação de produtos órfãos.
    const pageSize = 300;
    const maxRecords = 10000;
    const requestedSet = new Set(blingIds.map(id => Number(id)));
    const found = new Set<number>();

    for (let offset = 0; offset < maxRecords; offset += pageSize) {
        const page = await vpsApiService.getProducts({
            status: 'all',
            limit: pageSize,
            offset,
            noCache: true,
        });
        if (!page || page.length === 0) break;

        for (const p of page as any[]) {
            if (p?.bling_id == null) continue;
            const bid = Number(p.bling_id);
            if (!requestedSet.has(bid)) continue;
            // Mesma semântica do filtro anterior: ignora produtos órfãos de modelo e drafts estruturais.
            if (p.model_id == null) continue;
            if (p.status === 'draft') continue;
            found.add(bid);
        }

        if (page.length < pageSize) break;
    }

    return found;
}

export async function searchBlingProducts(query: string, onProgress?: (p: FetchProgress) => void): Promise<BlingProduct[]> {
    const accessToken = await getValidToken();

    // O estoque será buscado *depois* que os produtos forem carregados

    const all: BlingProduct[] = [];
    let page = 1;

    do {
        const res = await fetch(`/api/bling?resource=products&page=${page}&search=${encodeURIComponent(query)}&_t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            cache: 'no-store'
        });

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 350));

        if (!res.ok) throw new Error(`Bling API error ${res.status}`);
        const json = await res.json();
        const items = json.data || [];

        if (items.length === 0) break;

        const mapped: BlingProduct[] = items.map((item: any) => ({
            id: item.id,
            nome: item.nome || 'Produto sem nome',
            codigo: item.codigo || null,
            gtin: item.gtin || null,
            preco: item.preco || null,
            precoCusto: item.precoCusto || null,
            situacao: item.situacao || 'A',
            stock_quantity: 0, // Será preenchido abaixo
            categoria: item.categoria || undefined,
            marca: item.marca || undefined,
            imagens: item.imagens || [],
            variacao: item.variacao || undefined,
            formato: item.formato, // Necessário para a UI saber se ignora o click
        }));
        all.push(...mapped);
        onProgress?.({ phase: 'fetching_products', newItems: mapped, totalSoFar: all.length });

        if (items.length < 100) break;
        page++;
    } while (true);

    // Busca os estoques (Bling v3 exige passar idsProdutos[])
    onProgress?.({ phase: 'fetching_stock', totalSoFar: all.length });
    const productIds = all.map(p => p.id);
    const stockMap = await fetchStockMap(accessToken, productIds);

    for (const p of all) {
        p.stock_quantity = stockMap.get(p.id) ?? 0;
    }

    const parentIds = new Set<number>();
    for (const p of all) {
        const paiId = (p.variacao as any)?.produtoPai?.id;
        if (paiId) parentIds.add(paiId);
    }
    for (const p of all) {
        if (!p.formato && parentIds.has(p.id)) {
            p.formato = 'E';
        }
    }

    onProgress?.({ phase: 'done', totalSoFar: all.length });
    return all;
}


/** Traduz erros técnicos do PostgreSQL/Supabase para mensagens amigáveis em português */
function humanizeImportError(operation: string, rawMessage: string): string {
    const msg = rawMessage.toLowerCase();

    // Unique constraint violations
    if (msg.includes('unique') || msg.includes('duplicate key')) {
        if (msg.includes('ean') || msg.includes('gtin')) {
            return `EAN/código de barras já cadastrado em outro produto do sistema.`;
        }
        if (msg.includes('sku') || msg.includes('codigo')) {
            return `SKU já cadastrado em outro produto do sistema.`;
        }
        if (msg.includes('bling_id')) {
            return `Este produto do Bling já foi importado anteriormente.`;
        }
        return `Dado duplicado: já existe outro produto com o mesmo identificador único.`;
    }

    // Foreign key violations
    if (msg.includes('foreign key') || msg.includes('fk_')) {
        if (msg.includes('category') || msg.includes('categoria')) {
            return `Categoria selecionada não existe ou foi removida. Verifique o mapeamento de categorias.`;
        }
        if (msg.includes('model')) {
            return `Modelo selecionado não existe ou foi removido.`;
        }
        if (msg.includes('color') || msg.includes('cor')) {
            return `Cor mapeada não existe no sistema. Verifique o mapeamento de cores.`;
        }
        return `Referência inválida: um campo aponta para um registro que não existe.`;
    }

    // Not null violations
    if (msg.includes('not null') || msg.includes('null value')) {
        if (msg.includes('name') || msg.includes('nome')) {
            return `Nome do produto ausente. Verifique se o produto tem nome no Bling.`;
        }
        if (msg.includes('company_id')) {
            return `Empresa não identificada. Tente recarregar a página.`;
        }
        return `Campo obrigatório vazio: o produto está sem informação necessária para importar.`;
    }

    // Type errors
    if (msg.includes('invalid input syntax') || msg.includes('invalid value')) {
        return `Formato de dado inválido: verifique preço, peso ou dimensões do produto.`;
    }

    // Network / timeout
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch')) {
        return `Falha de conexão durante a ${operation}. Verifique sua internet e tente novamente.`;
    }

    // Token expired
    if (msg.includes('token_expired') || msg.includes('401')) {
        return `Token do Bling expirou. Acesse Configurações → Bling e reconecte.`;
    }

    // Bling API error
    if (msg.includes('bling api error')) {
        return `Erro ao buscar detalhes do produto no Bling. O produto pode ter sido excluído lá.`;
    }

    // Generic fallback with context
    return `Falha na ${operation}: ${rawMessage}`;
}

function normalizeExternalImageUrls(images: unknown[]): string[] {
    return images
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(value => value.trim())
        .filter(value => /^https?:\/\//i.test(value))
        .slice(0, 5);
}

function isVpsImageUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        const vpsBase = new URL(VPS_DIRECT_BASE_URL);
        return parsed.hostname === vpsBase.hostname && parsed.pathname.startsWith('/images/');
    } catch {
        return false;
    }
}

function safeBlingImageSku(sku: unknown, blingId: unknown): string {
    const source = String(sku || blingId || 'bling')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return source || `BLING-${String(blingId || Date.now())}`;
}

function extensionFromImage(sourceUrl: string, contentType: string | null): string {
    const type = String(contentType || '').toLowerCase();
    if (type.includes('avif')) return 'avif';
    if (type.includes('webp')) return 'webp';
    if (type.includes('png')) return 'png';
    if (type.includes('gif')) return 'gif';
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';

    try {
        const ext = new URL(sourceUrl).pathname.split('.').pop()?.toLowerCase();
        if (ext && ['avif', 'webp', 'png', 'gif', 'jpg', 'jpeg'].includes(ext)) {
            return ext === 'jpeg' ? 'jpg' : ext;
        }
    } catch {
        // fallback below
    }
    return 'jpg';
}

async function blingImageUploadHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getVpsSyncHeaders(),
        ...extra,
    };
}

async function fetchBlingImageBlob(sourceUrl: string): Promise<Blob> {
    const parsed = new URL(sourceUrl);
    const url = parsed.hostname === 'orgbling.s3.amazonaws.com'
        ? `/api/bling?resource=image-proxy&url=${encodeURIComponent(sourceUrl)}`
        : sourceUrl;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Falha ao baixar imagem (${response.status})`);
    }

    return response.blob();
}

async function uploadBlingImageToVps(
    sourceUrl: string,
    context: { sku?: unknown; blingId?: unknown; index: number }
): Promise<string> {
    if (isVpsImageUrl(sourceUrl)) return sourceUrl;

    const blob = await fetchBlingImageBlob(sourceUrl);
    const sku = safeBlingImageSku(context.sku, context.blingId);
    const ext = extensionFromImage(sourceUrl, blob.type);
    const filename = `bling-${String(context.blingId || sku)}-${String(context.index + 1).padStart(2, '0')}.${ext}`;
    const storagePath = `products/${sku}/${filename}`;
    const file = new File([blob], filename, { type: blob.type || `image/${ext}` });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', storagePath);

    const response = await fetch(buildVpsUrl('/images/upload', { method: 'POST' }), {
        method: 'POST',
        headers: await blingImageUploadHeaders(),
        body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.url) {
        throw new Error(data?.error || data?.message || `Falha ao subir imagem para VPS (${response.status})`);
    }

    return data.url;
}

async function materializeBlingImagesToVps(
    images: unknown[],
    context: { sku?: unknown; blingId?: unknown }
): Promise<string[]> {
    const normalized = normalizeExternalImageUrls(images);
    const uploaded: string[] = [];

    for (let index = 0; index < normalized.length; index++) {
        const sourceUrl = normalized[index];
        try {
            uploaded.push(await uploadBlingImageToVps(sourceUrl, { ...context, index }));
        } catch (error: any) {
            console.warn('[bling:images-to-vps] mantendo-url-original', {
                blingId: context.blingId,
                sku: context.sku,
                index,
                sourceUrl,
                reason: error?.message || String(error),
            });
            uploaded.push(sourceUrl);
        }
    }

    return uploaded;
}

export async function importBlingProducts(
    selectedProducts: BlingProduct[],
    enabledFields: Set<string>,
    categoryId: string,
    onProgress: (current: number, total: number, result: Partial<ImportResult>) => void,
    modelId?: string,
    autoCreateModel: boolean = false
): Promise<ImportResult> {
    const companyId = await getCompanyId();
    const categoryMappings = loadCategoryMappings();
    console.warn('[bling:import-start]', {
        defaultCategoryId: categoryId,
        mappingsCount: categoryMappings.length,
        mappingsWithCategory: categoryMappings.filter(m => !!m.ourCategoryId).length,
        sampleMappings: categoryMappings.slice(0, 10),
    });

    // Garante que todos os category_ids (principal + mapeados) existem no Supabase para evitar FK violation.
    // Categorias novas criadas pos-migracao existem apenas na VPS; precisamos espelha-las no Supabase.
    const { supabase } = await import('./supabase');
    const { categoryService } = await import('./categories');
    const allVpsCategories = await categoryService.list();
    const validVpsCategoryIds = new Set(allVpsCategories.map(c => c.id));

    async function ensureCategoryInSupabase(catId: string): Promise<void> {
        if (!catId) return;
        const { data: exists } = await supabase
            .from('categories')
            .select('id')
            .eq('id', catId)
            .eq('company_id', companyId)
            .maybeSingle();
        if (exists) {
            console.log('[bling:category-sync] already-exists', { catId, companyId });
            return;
        }

        const allCats = await categoryService.list();
        const cat = allCats.find(c => c.id === catId);
        if (!cat) {
            throw new Error(`Categoria ${catId} nao encontrada na VPS para espelhamento.`);
        }

        console.log('[bling:category-sync] syncing-from-vps', {
            catId,
            companyId,
            catName: cat.name,
        });

        const { error: syncError } = await supabase.from('categories').upsert({
            id: cat.id,
            company_id: companyId,
            name: cat.name,
            slug: cat.slug,
            config: cat.config || {},
            warranty_days: cat.warranty_days || 90,
            extended_warranty_enabled: cat.extended_warranty_enabled ?? false,
            margin_wholesale: cat.margin_wholesale || null,
            margin_reseller: cat.margin_reseller || null,
        }, { onConflict: 'id', ignoreDuplicates: false });

        if (syncError) {
            throw new Error(`Falha ao espelhar categoria ${catId} no Supabase: ${syncError.message}`);
        }

        console.log('[bling:category-sync] synced-ok', { catId, companyId });
    }

    // Sincroniza categoryId principal e todos os IDs mapeados para categorias do Bling
    const allMappedCatIds = new Set<string>();
    if (categoryId) allMappedCatIds.add(categoryId);
    loadCategoryMappings().forEach(m => { if (m.ourCategoryId) allMappedCatIds.add(m.ourCategoryId); });
    await Promise.all(Array.from(allMappedCatIds).map(id => ensureCategoryInSupabase(id)));

    // Fetch Category Margins
    let marginWholesale = 0;
    let marginReseller = 0;
    if (categoryId) {
        const { data: catData } = await supabase
            .from('categories')
            .select('margin_wholesale, margin_reseller')
            .eq('id', categoryId)
            .maybeSingle();
        marginWholesale = catData?.margin_wholesale || 0;
        marginReseller = catData?.margin_reseller || 0;
    }

    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const total = selectedProducts.length;
    const vpsRows: any[] = []; // collect successful rows for batch VPS sync

    const formatSupabaseError = (error: any): string => {
        if (!error) return 'Erro desconhecido no Supabase';
        const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
        return parts.join(' | ');
    };

    const extractMissingColumn = (message: string): string | null => {
        // PostgreSQL direto: column "image_url" of relation "products" does not exist
        const pgMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation\s+"products"\s+does\s+not\s+exist/i);
        if (pgMatch?.[1]) return pgMatch[1];

        // PostgREST (PGRST204): Could not find the 'image_url' column of 'products' in the schema cache
        const postgrestMatch = message.match(/could\s+not\s+find\s+the\s+'([^']+)'\s+column\s+of\s+'products'\s+in\s+the\s+schema\s+cache/i);
        if (postgrestMatch?.[1]) return postgrestMatch[1];

        return null;
    };

    const updateWithColumnFallback = async (id: string, initialFields: Record<string, any>): Promise<void> => {
        let fields = { ...initialFields };
        for (let attempt = 1; attempt <= 6; attempt++) {
            const { error } = await supabase
                .from('products')
                .update(fields)
                .eq('id', id);
            if (!error) return;

            const fullMsg = formatSupabaseError(error);

            // Trata conflitos de unique constraint: remove o campo conflitante e tenta novamente
            if (fullMsg.toLowerCase().includes('duplicate key') || fullMsg.toLowerCase().includes('unique')) {
                if ((fullMsg.toLowerCase().includes('slug')) && 'slug' in fields) {
                    console.warn('[bling:import-fallback] conflito de slug no update, mantendo slug existente', { id });
                    delete fields['slug'];
                    continue;
                }
                if ((fullMsg.toLowerCase().includes('ean') || fullMsg.toLowerCase().includes('gtin')) && 'ean' in fields) {
                    console.warn('[bling:import-fallback] conflito de EAN no update, removendo EAN', { id });
                    delete fields['ean'];
                    delete fields['alternative_eans'];
                    continue;
                }
                if ((fullMsg.toLowerCase().includes('sku') || fullMsg.toLowerCase().includes('codigo')) && 'sku' in fields) {
                    console.warn('[bling:import-fallback] conflito de SKU no update, removendo SKU', { id });
                    delete fields['sku'];
                    continue;
                }
                throw new Error(fullMsg);
            }

            const missingColumn = extractMissingColumn(fullMsg);
            if (!missingColumn || !(missingColumn in fields)) {
                throw new Error(fullMsg);
            }

            console.warn('[bling:import-fallback] removendo coluna ausente no update:', { missingColumn });
            delete fields[missingColumn];
        }

        throw new Error('Falha ao atualizar produto após fallback de colunas.');
    };

    const insertWithColumnFallback = async (initialRow: Record<string, any>): Promise<{ id: string; resolvedRow: Record<string, any> }> => {
        let row = { ...initialRow };
        for (let attempt = 1; attempt <= 6; attempt++) {
            const { data: insertedData, error } = await supabase
                .from('products')
                .insert(row)
                .select('id')
                .single();
            if (!error) return { id: insertedData?.id, resolvedRow: row };

            const fullMsg = formatSupabaseError(error);

            // Unique conflicts comuns na importação de variações
            if (fullMsg.toLowerCase().includes('duplicate key') || fullMsg.toLowerCase().includes('unique')) {
                if (fullMsg.toLowerCase().includes('ean')) {
                    row.ean = null;
                    row.alternative_eans = [];
                    console.warn('[bling:import-fallback] conflito de EAN detectado, removendo EAN para continuar importação', { blingId: row.bling_id });
                    continue;
                }
                if (fullMsg.toLowerCase().includes('slug')) {
                    const baseSlug = String(row.slug || 'produto').replace(/-+$/, '');
                    row.slug = `${baseSlug}-${row.bling_id || Date.now()}-${attempt}`;
                    console.warn('[bling:import-fallback] conflito de slug detectado, regenerando slug', { slug: row.slug });
                    continue;
                }
                if (fullMsg.toLowerCase().includes('sku') || fullMsg.toLowerCase().includes('codigo')) {
                    row.sku = null;
                    console.warn('[bling:import-fallback] conflito de SKU detectado, removendo SKU para continuar importação', { blingId: row.bling_id });
                    continue;
                }
            }

            const missingColumn = extractMissingColumn(fullMsg);
            if (!missingColumn || !(missingColumn in row)) {
                throw new Error(fullMsg);
            }

            console.warn('[bling:import-fallback] removendo coluna ausente no insert:', { missingColumn });
            delete row[missingColumn];
        }

        throw new Error('Falha ao inserir produto após fallback de colunas.'); // row never returned — caller handles the throw
    };

    // Resolve brand, model name e description (fallback quando Bling não traz)
    let modelBrandName: string | null = null;
    let modelName: string | null = null;
    let modelDescription: string | null = null;
    if (modelId) {
        const { data: modelData } = await supabase
            .from('models')
            .select('name, description, brand_id, brands(name)')
            .eq('id', modelId)
            .maybeSingle();
        modelBrandName = (modelData?.brands as any)?.name || null;
        modelName = modelData?.name || null;
        modelDescription = (modelData as any)?.description || null;
    }

    // Caches for auto-create mode to avoid duplicate db lookups/inserts
    const brandCache = new Map<string, string>(); // name -> id
    const modelCache = new Map<string, string>(); // cacheKey -> id
    const crossSellTagCache = new Set<string>(); // name defined

    for (let i = 0; i < selectedProducts.length; i++) {

        const item = selectedProducts[i];
        let operation = 'verificação';
        let resolvedCategoryForDebug: string | null = null;
        try {
            // Busca detalhe completo: herda campos do pai quando for variação
            const detail = await fetchBlingProductDetail(item.id);
            const enriched = detail ? {
                ...item,
                ...detail,
                codigo: detail.codigo ?? item.codigo,
                gtin: detail.gtin ?? item.gtin,            // EAN do filho ou pai
                categoria: detail.categoria ?? item.categoria,
                precoCusto: detail.precoCusto ?? item.precoCusto,
                preco: detail.preco ?? item.preco,
                descricaoComplementar: detail.descricaoComplementar || item.descricaoComplementar,
                descricaoCurta: detail.descricaoCurta || item.descricaoCurta,
                tributacao: {
                    ncm: detail.ncm,
                    cest: detail.cest,
                    origem: detail.origem,
                },
                // pesoBruto também no root para fallback em mapBlingToDb
                pesoBruto: detail.pesoBruto,
                dimensoes: {
                    pesoBruto: detail.pesoBruto,
                    largura: detail.largura,
                    altura: detail.altura,
                    profundidade: detail.profundidade,
                },
                imagens: detail.imagens?.length ? detail.imagens : item.imagens,
                stock_quantity: detail.stock_quantity ?? item.stock_quantity,
            } : item;

            const row = mapBlingToDb(enriched, companyId, enabledFields, categoryId, modelId, marginWholesale, marginReseller, modelDescription);

            // Se o mapeamento local estiver desatualizado (categoria removida/trocada), cai para a categoria padrão.
            if (!row.category_id || !validVpsCategoryIds.has(row.category_id)) {
                console.warn('[bling:category-fallback]', {
                    productId: item.id,
                    productName: item.nome,
                    blingCategoryId: enriched?.categoria?.id ?? null,
                    mappedCategoryId: row.category_id || null,
                    fallbackCategoryId: categoryId,
                });
                row.category_id = categoryId;
            }

            resolvedCategoryForDebug = row.category_id || null;

            // Debug hard-stop: mostra exatamente quando category_id resolvido nao existe no Supabase
            if (row.category_id) {
                const { data: resolvedCategory, error: resolvedCategoryError } = await supabase
                    .from('categories')
                    .select('id, name')
                    .eq('id', row.category_id)
                    .eq('company_id', companyId)
                    .maybeSingle();

                if (resolvedCategoryError || !resolvedCategory) {
                    throw new Error(
                        `category_sync_missing: resolved_category_id=${row.category_id}; default_category_id=${categoryId}; bling_category_id=${enriched?.categoria?.id ?? 'null'}; product_id=${item.id}; product_name=${item.nome}`
                    );
                }

                console.log('[bling:category-resolved-ok]', {
                    productId: item.id,
                    productName: item.nome,
                    blingCategoryId: enriched?.categoria?.id ?? null,
                    resolvedCategoryId: row.category_id,
                    resolvedCategoryName: (resolvedCategory as any).name,
                });
            }
            
            operation = 'verificação de duplicata';
            const { data: existing, error: checkError } = await supabase
                .from('products')
                .select('id, model_id')
                .eq('company_id', companyId)
                .eq('bling_id', item.id)
                .maybeSingle();

            if (checkError) throw new Error(checkError.message);

            let finalModelId = (existing && existing.model_id) ? existing.model_id : modelId;

            // --- AUTO-CREATE/RESOLVE BRAND LOGIC (Always runs) ---
            // Extrai a marca do Bling ou assume "Diversos" caso falhe e precisemos gerar um modelo
            let rawBrandName = 'Diversos';
            const extractedMarca = typeof enriched.marca === 'object' ? enriched.marca?.nome : enriched.marca;
            if (typeof extractedMarca === 'string' && extractedMarca.trim()) {
                rawBrandName = extractedMarca.trim();
            }

            // Formata para Title Case (ex: "CINEBOX" -> "Cinebox", "cinebox supremo" -> "Cinebox Supremo")
            let brandName = rawBrandName.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
            
            let resolvedBrandId = brandCache.get(brandName);
            if (!resolvedBrandId) {
                const brands = await brandService.list();
                const normalizeString = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                const expectedSlug = normalizeString(brandName);
                const existingBrand = brands.find(b => b.slug === expectedSlug || normalizeString(b.name) === expectedSlug);
                if (existingBrand) {
                    resolvedBrandId = existingBrand.id;
                } else {
                    const newBrand = await brandService.create({ name: brandName, active: true, warranty_days: 90 });
                    resolvedBrandId = newBrand.id;
                }
                brandCache.set(brandName, resolvedBrandId);
            }
            
            // Grava a marca real, formatada, no produto inserido. Se não existia no Bling, mantemos null no produto de Varejo (Products Table).
            row.brand = (extractedMarca && typeof extractedMarca === 'string' && extractedMarca.trim()) ? brandName : null;

            // Se o produto já existe e tem um modelo, sincronizamos a marca real do Bling via server-side (bypassa RLS)
            if (existing && finalModelId && brandName && brandName !== 'Diversos') {
                fetch('/api/bling?resource=sync-model-brand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model_id: finalModelId, brand_name: brandName })
                }).catch(e => console.warn('Failed to sync model brand:', e));
            }

            // --- AUTO-CREATE MODEL LOGIC ---
            if (autoCreateModel && !finalModelId) {
                // Prioriza o nome literal da Estrutura/Pai. Se não houver, tenta limpar variações explícitas do titulo
                let baseName = enriched.nomePai || row.name || 'Produto sem nome';
                let newModelName = baseName.replace(/\s?-?\s?(Cor|Tamanho):?\s?.*$/i, '').trim();
                
                // Extrai apenas o modelo de dispositivo para gerar a TAG Limpa (ex: tudo após ' para ')
                let cleanTag = newModelName;
                const paraIndex = newModelName.toLowerCase().lastIndexOf(' para ');
                if (paraIndex !== -1) {
                    cleanTag = newModelName.substring(paraIndex + 6).trim();
                } else {
                    // Tenta remover a palavra capa/capinha caso não exista " para "
                    cleanTag = cleanTag.replace(/^(Capa\sde\s[^\s]+|Capa\s[a-zA-Z]+|Capinha|Película(\s3D|\sVidro)?)\s/i, '').trim();
                }
                // 2. Resolve/Create Model
                const cacheKey = `${resolvedBrandId}_${newModelName}`.toLowerCase();
                let resolvedModelId = modelCache.get(cacheKey);
                if (!resolvedModelId) {
                    const models = await modelService.list();
                    const normalizeSlug = (value: string) => value
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                    const modelSlug = normalizeSlug(newModelName);
                    const existingModel = models.find(m =>
                        (m.slug && m.slug === modelSlug) ||
                        normalizeSlug(m.name) === modelSlug
                    );
                    
                    if (existingModel) {
                        resolvedModelId = existingModel.id;
                        // If the model was previously under "Diversos" (or another brand), update it to the true brand via server-side endpoint
                        if (existingModel.brand_id !== resolvedBrandId && brandName !== 'Diversos') {
                            fetch('/api/bling?resource=sync-model-brand', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ model_id: existingModel.id, brand_name: brandName })
                            }).catch(e => console.warn('Failed to update model brand:', e));
                        }
                    } else {
                        // Create Cross-Sell Tag usando apenas o nome limpo
                        if (!crossSellTagCache.has(cleanTag.toLowerCase())) {
                            try {
                                await crossSellTagsService.create({ name: cleanTag });
                            } catch(e) { /* silently ignore if already exists but wasn't in cache */ }
                            crossSellTagCache.add(cleanTag.toLowerCase());
                        }

                        // Create Model with Dimensions and Tag
                        const newModel = await modelService.create({
                            name: newModelName,
                            brand_id: resolvedBrandId,
                            category_id: categoryId || undefined,
                            active: true,
                            template_values: {
                                'weight_kg': enriched.pesoBruto,
                                'dimensions.width_cm': enriched.dimensoes?.largura,
                                'dimensions.height_cm': enriched.dimensoes?.altura,
                                'dimensions.depth_cm': enriched.dimensoes?.profundidade,
                                'tags_venda': [cleanTag]
                            }
                        });
                        resolvedModelId = newModel.id;
                    }
                    modelCache.set(cacheKey, resolvedModelId);
                }
                
                finalModelId = resolvedModelId;
                
                // Set the brand to the inferred brand
                row.brand = brandName;
            }

            // Fallback: if Bling didn't provide a brand, use the one from the selected model (only if we didn't just auto-create it)
            if (!row.brand && modelBrandName && finalModelId === modelId) row.brand = modelBrandName;

            row.model_id = finalModelId || null;
            // Materializa as imagens do Bling na VPS; se uma falhar, preserva a URL original para nao quebrar o produto.
            row.images = await materializeBlingImagesToVps(Array.isArray(row.images) ? row.images : [], {
                sku: row.sku || item.codigo,
                blingId: item.id,
            });
            row.image_url = row.images[0] || row.image_url || null;

            // Extrai _color_id auxiliar antes de enviar para o banco
            const { _color_id: resolvedColorId, ...dbRow } = row;

            if (existing) {
                operation = 'atualização';
                // Remove campos que não devem ser sobrescritos em updates
                // NOTA: specs (cor, ram, storage) é INCLUÍDO para que mudanças de variação
                // no Bling (ex: "vinho escuro" → "vinho") sejam refletidas ao reimportar.
                const { company_id, bling_id, stock_quantity, track_inventory, is_gift, warranty_type, ...updateFields } = dbRow;
                await updateWithColumnFallback(existing.id, updateFields);
                result.updated++;
                vpsRows.push({ ...dbRow, id: existing.id });
            } else {
                operation = 'criação';
                const insertedData = await insertWithColumnFallback(dbRow);
                result.created++;
                // Use resolvedRow so that any slug/sku/ean modified during conflict fallback
                // is propagated to the VPS (not the original conflicting value from dbRow).
                vpsRows.push({ ...insertedData.resolvedRow, id: insertedData.id });
            }

            // Associa cor ao model_color_images se o produto tiver model_id e cor mapeada
            if (resolvedColorId && dbRow.model_id && dbRow.images?.length) {
                try {
                    await modelColorImagesService.upsert({
                        model_id: dbRow.model_id,
                        color_id: resolvedColorId,
                        images: dbRow.images,
                    });
                } catch (colorErr: any) {
                    // Não bloqueia a importação — apenas avisa no console
                    console.warn('[importBlingProducts] Falha ao salvar model_color_images:', colorErr.message);
                }
            }
        } catch (err: any) {
            const rawMessage = err?.message || String(err);
            console.error('[bling:import-error-raw]', {
                operation,
                productId: item.id,
                productName: item.nome,
                productSku: item.codigo,
                resolvedCategoryId: resolvedCategoryForDebug,
                rawMessage,
            });
            result.errors.push({
                name: item.nome,
                sku: item.codigo,
                reason: humanizeImportError(operation, rawMessage),
            });
        }

        // Respeitar limite de requisições do Bling (3req/segundo). 
        // Como o product-detail já faz 2 requests (produtos + estoques), aguardamos ~700ms para estabilidade total.
        await new Promise(resolve => setTimeout(resolve, 700));

        onProgress(i + 1, total, result);
    }

    // Sync all successfully imported products to VPS MySQL — aguarda antes de retornar
    // para evitar race condition onde a lista de produtos é carregada antes da sync completar.
    if (vpsRows.length > 0) {
        try {
            const ok = await vpsApiService.syncProducts(vpsRows);
            if (!ok) {
                // Sync parcial: alguns produtos podem ter ficado só no Supabase (órfãos),
                // não aparecendo na listagem /admin/products. Surface para o usuário retryar.
                result.errors.push({
                    name: `Sincronização parcial com VPS (${vpsRows.length} produto(s))`,
                    sku: '',
                    reason: 'Um ou mais produtos foram salvos no Supabase mas falharam ao sincronizar com a VPS. Eles podem não aparecer na listagem. Verifique o console do navegador e rode o script de reconciliação de órfãos.',
                });
            }
        } catch (err: any) {
            console.warn('[blingService] VPS batch sync failed:', err);
            result.errors.push({
                name: `Sincronização com VPS falhou (${vpsRows.length} produto(s))`,
                sku: '',
                reason: `Produtos salvos no Supabase podem não aparecer na listagem: ${err?.message || String(err)}. Rode o script de reconciliação de órfãos para recuperar.`,
            });
        }
    }

    return result;
}

export async function pushModelDimensionsToBling(modelId: string): Promise<{ ok: boolean; results?: any[]; error?: string }> {
    const companyId = await getCompanyId();

    // 1. Fetch Model dimensions from template_values
    const { data: model, error: modelErr } = await supabase
        .from('models')
        .select('name, template_values')
        .eq('id', modelId)
        .eq('company_id', companyId)
        .single();

    if (modelErr || !model) {
        throw new Error('Modelo não encontrado ou erro ao buscar.');
    }

    const { template_values } = model;
    const weight_kg = template_values?.['weight_kg'];
    const width_cm = template_values?.['dimensions.width_cm'];
    const height_cm = template_values?.['dimensions.height_cm'];
    const depth_cm = template_values?.['dimensions.depth_cm'];

    if (weight_kg == null && width_cm == null && height_cm == null && depth_cm == null) {
        throw new Error('O modelo não possui dimensões cadastradas no Template para sincronizar.');
    }

    // 2. Fetch all unique bling_ids associated with this model's products
    // Note: We group by bling_id as a single model could have multiple variants, but each variant might be a distinct product in Bling.
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('bling_id')
        .eq('model_id', modelId)
        .eq('company_id', companyId)
        .not('bling_id', 'is', null);

    if (prodErr) throw new Error(prodErr.message);

    const blingIds = Array.from(new Set(products.map(p => p.bling_id)));
    if (blingIds.length === 0) {
        throw new Error('Nenhum produto com Vínculo Bling encontrado para este modelo.');
    }

    // 3. Prepare payload and call the proxy endpoint
    const updateData = {
        pesoBruto: weight_kg !== null ? weight_kg : undefined,
        dimensoes: {
            largura: width_cm !== null ? width_cm : undefined,
            altura: height_cm !== null ? height_cm : undefined,
            profundidade: depth_cm !== null ? depth_cm : undefined,
        }
    };

    const res = await fetch('/api/bling?resource=product-update-dimensions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ blingIds, updateData })
    });

    if (!res.ok) {
        throw new Error(`Proxy error: ${res.status}`);
    }

    const json = await res.json();
    return json;
}

export async function pullModelDimensionsFromBling(modelId: string): Promise<{ ok: boolean; dimensions?: any; error?: string }> {
    const companyId = await getCompanyId();

    // 1. Fetch a product with bling_id
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('bling_id')
        .eq('model_id', modelId)
        .eq('company_id', companyId)
        .not('bling_id', 'is', null)
        .limit(1);

    if (prodErr || !products || products.length === 0) {
        throw new Error('Nenhum produto com Vínculo Bling encontrado para este modelo.');
    }

    const blingId = products[0].bling_id;

    // 2. Call product-detail API via proxy
    try {
        const detail = await fetchBlingProductDetail(blingId);
        
        if (!detail) {
            throw new Error('Produto não encontrado no Bling ou falha ao buscar detalhes.');
        }

        const weight_kg = detail.pesoBruto || null;
        const width_cm = detail.largura || null;
        const height_cm = detail.altura || null;
        const depth_cm = detail.profundidade || null;

        if (weight_kg == null && width_cm == null && height_cm == null && depth_cm == null) {
            throw new Error('O produto correspondente no Bling não possui dimensões cadastradas.');
        }

        // 3. Fetch existing template_values first so we don't overwrite other fields
        const { data: existingModel } = await supabase
            .from('models')
            .select('template_values')
            .eq('id', modelId)
            .eq('company_id', companyId)
            .single();

        const newTemplateValues = {
            ...(existingModel?.template_values || {}),
            'weight_kg': weight_kg,
            'dimensions.width_cm': width_cm,
            'dimensions.height_cm': height_cm,
            'dimensions.depth_cm': depth_cm
        };

        // 4. Update Model
        const { error: updateErr } = await supabase
            .from('models')
            .update({ template_values: newTemplateValues })
            .eq('id', modelId)
            .eq('company_id', companyId);

        if (updateErr) throw new Error('Falha ao salvar as dimensões importadas no modelo local.');

        return { ok: true, dimensions: { weight_kg, width_cm, height_cm, depth_cm } };
    } catch (e: any) {
        throw new Error(e.message || 'Erro ao puxar dimensões do Bling');
    }
}

/** 
 * Reimporta/Sincroniza os detalhes vitais (SKU, EAN) dos produtos de um modelo específico 
 * direto do Bling para resolver falhas de importação antiga sem SKU.
 */
export async function reimportModelProductsFromBling(modelId: string): Promise<number> {
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, bling_id, specs')
        .eq('model_id', modelId)
        .not('bling_id', 'is', null);
        
    if (error) throw new Error('Falha ao buscar produtos no banco de dados para reimportação.');
    if (!products || products.length === 0) throw new Error('Nenhum produto com ID do Bling encontrado neste modelo.');

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let count = 0;
    for (const p of products) {
        // Wait 1000ms between requests to respect Bling's 3 req/sec limit
        // (Since fetchBlingProductDetail can make 2 requests: parent + child)
        await sleep(1000);
        
        const detail = await fetchBlingProductDetail(Number(p.bling_id));
        if (!detail) continue;

        // Atualiza campos-chave para corrigir problemas de importação (SKU, EAN, Custo, Preços base, Imagens)
        const updateData: any = {};
        if (detail.codigo) updateData.sku = detail.codigo;
        if (detail.gtin) updateData.ean = detail.gtin;
        if (detail.precoCusto) updateData.price_cost = Math.round(detail.precoCusto * 100);
        if (detail.preco) updateData.price_retail = Math.round(detail.preco * 100);
        
        // Verifica e extrai imagens
        const imagens = detail.midia?.imagens?.internas || detail.imagens || [];
        const extractedUrls = imagens.slice(0, 5).map((img: any) => img?.link || img?.url || (typeof img === 'string' ? img : null)).filter(Boolean);

        if (extractedUrls.length > 0) {
            const processedImages = await materializeBlingImagesToVps(extractedUrls, {
                sku: p.sku || detail.codigo,
                blingId: p.bling_id,
            });
            if (processedImages.length > 0) {
                updateData.images = processedImages;
                updateData.image_url = processedImages[0];
                
                // Também atualiza a galeria compartilhada da cor da PRIMEIRA foto se houver
                const colorId = resolveColorId(p.specs?.color);
                if (colorId && modelId && processedImages[0]) {
                    try {
                        await modelColorImagesService.upsert({
                            model_id: modelId,
                            color_id: colorId,
                            images: processedImages
                        });
                    } catch (e) { console.error('Erro ao resincronizar cor-imagem no reimport', e); }
                }
            }
        }
        
        // Não sobrescrever nome, categoria para não estragar edições passadas do usuário.
        
        if (Object.keys(updateData).length > 0) {
            await supabase.from('products').update(updateData).eq('id', p.id);
            count++;
        }
    }
    return count;
}

export const blingService = {
    getValidToken,
    fetchAllBlingProducts,
    searchBlingProducts,
    importBlingProducts,
    checkExistingBlingProducts,
    pushModelDimensionsToBling,
    pullModelDimensionsFromBling,
    reimportModelProductsFromBling,
};

