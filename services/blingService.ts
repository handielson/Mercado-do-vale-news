import { supabase } from './supabase';
import { modelColorImagesService } from './model-color-images';
import { modelService } from './models';
import { brandService } from './brands';
import { crossSellTagsService } from './cross-sell-tags';
import { compressImage } from '../utils/image-compression';

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
        const res = await fetch(`/api/bling?resource=product-detail&id=${productId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        const data = await res.json();

        // Se for variação, busca o pai para herdar campos que o Bling só retorna no pai
        const parentId: number | undefined = data.variacao?.produtoPai?.id;
        let parentData: any = null;
        if (parentId) {
            const parentRes = await fetch(`/api/bling?resource=product-detail&id=${parentId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            if (parentRes.ok) parentData = await parentRes.json();
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
            const externas = d?.midia?.imagens?.imagensURL || [];
            return [...internas, ...externas];
        };

        let imagens: any[] = extractImagens(data);
        if (!imagens.length) imagens = extractImagens(parentData);

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
            descricaoCurta: data.descricaoCurta || undefined,
            descricaoComplementar: data.descricaoComplementar || undefined,
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

export async function getValidToken(): Promise<string> {
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
function mapBlingToDb(item: any, companyId: string, _enabledFields: Set<string>, categoryId: string, modelId?: string, marginWholesale: number = 0, marginReseller: number = 0): Record<string, any> {
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
        sku: item.codigo || null,
        ean: item.gtin || null,
        alternative_eans: item.gtin ? [item.gtin] : [],
        brand: item.marca || null,
        description: item.descricao || item.descricaoComplementar || item.descricaoCurta || null,
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
        // Specs (variação: color, size...)
        specs,
        // Mídia

        images: firstImg ? [firstImg] : [],
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
            .select('bling_id')
            .eq('id', productId)
            .maybeSingle();

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

export async function fetchAllBlingProducts(): Promise<BlingProduct[]> {
    const accessToken = await getValidToken();
    const all: BlingProduct[] = [];
    let page = 1;

    // O estoque será buscado *depois* que os produtos forem carregados

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
            stock_quantity: 0, // Será preenchido abaixo
            categoria: item.categoria || undefined,
            marca: item.marca || undefined,
            imagens: item.imagens || [],
            variacao: item.variacao || undefined,
            formato: item.formato, // Necessário para exibir Produto Pai corretamente
        })));
        if (items.length < 100) break;
        page++;
    } while (true);

    // Busca os estoques (Bling v3 exige passar idsProdutos[])
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

    return all;
}

// ------- Search specific products in Bling -------

export async function checkExistingBlingProducts(blingIds: number[]): Promise<Set<number>> {
    if (blingIds.length === 0) return new Set();
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('products')
        .select('bling_id')
        .eq('company_id', companyId)
        .in('bling_id', blingIds)
        .not('model_id', 'is', null) // Ignora produtos que ficaram órfãos ao deletar modelo
        .neq('status', 'draft');     // Ignora produtos "pai" estruturais

    if (error) {
        console.error('[checkExistingBlingProducts] Falha:', error.message);
        return new Set();
    }

    return new Set(data.filter(p => p.bling_id != null).map(p => p.bling_id));
}

export async function searchBlingProducts(query: string): Promise<BlingProduct[]> {
    const accessToken = await getValidToken();

    // O estoque será buscado *depois* que os produtos forem carregados

    const all: BlingProduct[] = [];
    let page = 1;

    do {
        const res = await fetch(`/api/bling?resource=products&page=${page}&search=${encodeURIComponent(query)}&_t=${Date.now()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            cache: 'no-store'
        });

        if (!res.ok) throw new Error(`Bling API error ${res.status}`);
        const json = await res.json();
        const items = json.data || [];
        
        if (items.length === 0) break;

        all.push(...items.map((item: any) => ({
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
        })));

        if (items.length < 100) break;
        page++;
    } while (true);

    // Busca os estoques (Bling v3 exige passar idsProdutos[])
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

// Helper: Baixa a imagem via proxy, converte pra blob, comprime e retorna base64
async function fetchAndCompressImage(url: string): Promise<string | null> {
    try {
        const proxyUrl = `/api/bling?resource=image-proxy&url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) return null;
        
        const blob = await res.blob();
        const file = new File([blob], 'bling-image.jpg', { type: blob.type || 'image/jpeg' });
        
        const compressed = await compressImage(file);
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(compressed);
        });
    } catch (e) {
        console.warn('Failed to fetch/compress Bling image:', e);
        return null;
    }
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

    // Fetch Category Margins
    let marginWholesale = 0;
    let marginReseller = 0;
    if (categoryId) {
        const { supabase } = await import('./supabase');
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

    // Resolve brand and model name for use as fallback values
    let modelBrandName: string | null = null;
    let modelName: string | null = null;
    if (modelId) {
        const { data: modelData } = await supabase
            .from('models')
            .select('name, brand_id, brands(name)')
            .eq('id', modelId)
            .maybeSingle();
        modelBrandName = (modelData?.brands as any)?.name || null;
        modelName = modelData?.name || null;
    }

    // Caches for auto-create mode to avoid duplicate db lookups/inserts
    const brandCache = new Map<string, string>(); // name -> id
    const modelCache = new Map<string, string>(); // cacheKey -> id
    const crossSellTagCache = new Set<string>(); // name defined

    for (let i = 0; i < selectedProducts.length; i++) {

        const item = selectedProducts[i];
        let operation = 'verificação';
        try {
            // Busca detalhe completo: herda campos do pai quando for variação
            const detail = await fetchBlingProductDetail(item.id);
            const enriched = detail ? {
                ...item,
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

            const row = mapBlingToDb(enriched, companyId, enabledFields, categoryId, modelId, marginWholesale, marginReseller);
            let finalModelId = modelId;

            // --- AUTO-CREATE MODEL LOGIC ---
            if (autoCreateModel && !finalModelId) {
                const brandName = enriched.marca || 'Diversos';
                
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
                
                // 1. Resolve/Create Brand
                let resolvedBrandId = brandCache.get(brandName);
                if (!resolvedBrandId) {
                    const brands = await brandService.listActive();
                    const existingBrand = brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
                    if (existingBrand) {
                        resolvedBrandId = existingBrand.id;
                    } else {
                        const newBrand = await brandService.create({ name: brandName, active: true, warranty_days: 90 });
                        resolvedBrandId = newBrand.id;
                    }
                    brandCache.set(brandName, resolvedBrandId);
                }
                
                // 2. Resolve/Create Model
                const cacheKey = `${resolvedBrandId}_${newModelName}`.toLowerCase();
                let resolvedModelId = modelCache.get(cacheKey);
                if (!resolvedModelId) {
                    const models = await modelService.list();
                    const existingModel = models.find(m => m.brand_id === resolvedBrandId && m.name.toLowerCase() === newModelName.toLowerCase());
                    
                    if (existingModel) {
                        resolvedModelId = existingModel.id;
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

            operation = 'verificação de duplicata';
            const { data: existing, error: checkError } = await supabase
                .from('products')
                .select('id')
                .eq('company_id', companyId)
                .eq('bling_id', item.id)
                .maybeSingle();

            if (checkError) throw new Error(checkError.message);

            // Fetch e Compress da imagem principal antes do Upsert
            if (row.images && row.images.length > 0) {
                const imgUrl = row.images[0];
                if (imgUrl && imgUrl.startsWith('http')) {
                    operation = 'download de imagem';
                    const base64 = await fetchAndCompressImage(imgUrl);
                    if (base64) {
                        row.images = [base64];
                    }
                }
            }

            // Extrai _color_id auxiliar antes de enviar para o banco
            const { _color_id: resolvedColorId, ...dbRow } = row;

            if (existing) {
                operation = 'atualização';
                // Remove campos que não devem ser sobrescritos em updates
                // NOTA: specs (cor, ram, storage) é INCLUÍDO para que mudanças de variação
                // no Bling (ex: "vinho escuro" → "vinho") sejam refletidas ao reimportar.
                const { company_id, bling_id, stock_quantity, track_inventory, is_gift, warranty_type, ...updateFields } = dbRow;
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
                    .insert(dbRow);
                if (error) throw new Error(error.message);
                result.created++;
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
            result.errors.push({
                name: item.nome,
                sku: item.codigo,
                reason: humanizeImportError(operation, err.message || ''),
            });
        }

        onProgress(i + 1, total, result);
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
        .select('id, bling_id, specs')
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
        const firstImgUrl = imagens[0]?.link || imagens[0]?.url || (typeof imagens[0] === 'string' ? imagens[0] : null);

        if (firstImgUrl && firstImgUrl.startsWith('http')) {
            const base64 = await fetchAndCompressImage(firstImgUrl);
            if (base64) {
                updateData.images = [base64];
                
                // Também atualiza a galeria compartilhada da cor, se houver
                const colorId = resolveColorId(p.specs?.color);
                if (colorId && modelId) {
                    try {
                        // Fazemos um upsert seguro garantindo que a base64 esteja lá. 
                        // Idealmente preservaria caso tenha outras, mas o reimport assume a do Bling.
                        await modelColorImagesService.upsert({
                            model_id: modelId,
                            color_id: colorId,
                            images: [base64]
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

