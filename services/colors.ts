
import { Color, ColorInput } from '../types/color';
import { vpsClient } from './vpsClient';
import { getCompanyId } from './companyContext';

/**
 * COLOR SERVICE - VPS Implementation
 * Multi-tenant service with Row Level Security
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Online storage via VPS (not localStorage)
 * - Multi-tenant with company_id isolation
 * - Follows same pattern as brandService
 * - Includes hex_code mapping for visual preview
 */

// Color mapping for visual preview (fallback if hex_code not in DB)
export const COLOR_MAP: Record<string, string> = {
    // Básicos
    'Preto': '#000000',
    'Preto Fosco': '#1C1C1C',
    'Branco': '#FFFFFF',
    'Off White': '#FAF9F6',
    'Branco Perolado': '#F5F5F5',
    'Marfim': '#FFFFF0',
    'Creme': '#FFFDD0',
    // Cinzas e Grafite
    'Cinza': '#6B7280',
    'Cinza Escuro': '#4A4A4A',
    'Cinza Médio': '#9CA3AF',
    'Cinza Claro': '#D1D5DB',
    'Cinza Prata': '#C0C0C0',
    'Prata': '#9CA3AF',
    'Grafite': '#2F4F4F',
    'Carvão': '#36454F',
    // Dourados e Amarelos
    'Dourado': '#F59E0B',
    'Ouro': '#FFD700',
    'Amarelo': '#EAB308',
    'Amarelo Claro': '#FEF08A',
    'Amarelo Ouro': '#FFD700',
    'Mel': '#FFC30B',
    'Mostarda': '#FFDB58',
    'Champagne': '#F7E7CE',
    'Baunilha': '#F3E5AB',
    // Laranjas e Pêssego
    'Laranja': '#F97316',
    'Laranja Escuro': '#EA580C',
    'Tangerina': '#F28500',
    'Coral': '#FF7F50',
    'Pêssego': '#FFCBA4',
    'Salmão': '#FA8072',
    'Terracota': '#E2725B',
    'Ferrugem': '#C23B22',
    // Vermelhos e Vinhos
    'Vermelho': '#EF4444',
    'Vermelho Escuro': '#B91C1C',
    'Vermelho Vivo': '#FF0000',
    'Cereja': '#DE3163',
    'Framboesa': '#C72C6B',
    'Bordô': '#800020',
    'Vinho': '#722F37',
    'Borgonha': '#800000',
    // Rosas e Magentas
    'Rosa': '#EC4899',
    'Rosa Claro': '#FBCFE8',
    'Rosa Bebê': '#FFB6C1',
    'Rosa Chique': '#FF69B4',
    'Rosa Escuro': '#C2185B',
    'Rosé': '#FF8FAB',
    'Fúcsia': '#FF77FF',
    'Magenta': '#FF00FF',
    'Nude': '#F5CBA7',
    // Roxos e Lilás
    'Roxo': '#8B5CF6',
    'Roxo Escuro': '#6D28D9',
    'Roxo Claro': '#C084FC',
    'Violeta': '#EE82EE',
    'Lilás': '#C8A2C8',
    'Lavanda': '#E6E6FA',
    'Índigo': '#4B0082',
    'Anil': '#233E8B',
    // Azuis
    'Azul': '#3B82F6',
    'Azul Claro': '#93C5FD',
    'Azul Celeste': '#87CEEB',
    'Azul Bebê': '#89CFF0',
    'Azul Royal': '#4169E1',
    'Azul Cobalto': '#0047AB',
    'Azul Marinho': '#001F5B',
    'Azul Petróleo': '#005F6B',
    'Azul Meia-Noite': '#191970',
    'Azul Safira': '#0F52BA',
    'Azul Escuro': '#00008B',
    'Ciano': '#00FFFF',
    'Azul Turquesa': '#00CED1',
    // Verdes
    'Verde': '#10B981',
    'Verde Claro': '#86EFAC',
    'Verde Limão': '#32CD32',
    'Verde Menta': '#98FF98',
    'Verde Musgo': '#8A9A5B',
    'Verde Oliva': '#808000',
    'Verde Militar': '#4B5320',
    'Verde Esmeralda': '#50C878',
    'Verde Água': '#00CED1',
    'Verde Floresta': '#228B22',
    'Verde Escuro': '#005000',
    'Pistache': '#93C572',
    'Turquesa': '#40E0D0',
    'Tiffany': '#0ABAB5',
    // Marrons e Terrosos
    'Marrom': '#8B4513',
    'Marrom Claro': '#A0785A',
    'Caramelo': '#AF6E2C',
    'Khaki': '#C3B091',
    'Bege': '#F5F5DC',
    'Cobre': '#B87333',
    'Bronze': '#CD7F32',
    'Canela': '#D2691E',
    'Cacau': '#5C3D2E',
};


/**
 * Generate URL-friendly slug from color name
 */
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Cache + dedup de list() — várias telas montam ProductCards/filtros simultaneamente
// e a lista de cores é praticamente estática (admin só altera ocasionalmente).
let listCache: { data: Color[]; expiresAt: number } | null = null;
let listInFlight: Promise<Color[]> | null = null;
const LIST_TTL_MS = 5 * 60 * 1000;

function clearListCache() { listCache = null; }

type ColorRow = {
    id: string;
    company_id?: string | null;
    name: string;
    slug?: string | null;
    hex_code?: string | null;
    active?: boolean | number | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

function normalizeColor(row: ColorRow): Color {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug || generateSlug(row.name),
        hex_code: row.hex_code || undefined,
        active: row.active === undefined || row.active === null ? true : Boolean(row.active),
        created: row.created_at || '',
        updated: row.updated_at || '',
    };
}

function sortColors(colors: Color[]): Color[] {
    return [...colors].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function stripUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

async function loadColorRows(): Promise<ColorRow[]> {
    const companyId = await getCompanyId();
    const pageSize = 200;
    let offset = 0;
    const rows: ColorRow[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<ColorRow>>(
            `/table-data/colors?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return companyId
        ? rows.filter(row => !row.company_id || row.company_id === companyId)
        : rows;
}

/**
 * List all colors
 */
async function list(): Promise<Color[]> {
    if (listCache && Date.now() < listCache.expiresAt) return listCache.data;
    if (listInFlight) return listInFlight;

    listInFlight = (async () => {
        try {
            const result = sortColors((await loadColorRows()).map(normalizeColor));
            listCache = { data: result, expiresAt: Date.now() + LIST_TTL_MS };
            return result;
        } finally {
            listInFlight = null;
        }
    })();

    return listInFlight;
}

/**
 * Get color by ID
 */
async function getById(id: string): Promise<Color | null> {
    const color = (await loadColorRows()).find(row => row.id === id);
    return color ? normalizeColor(color) : null;
}

/**
 * Create new color
 */
async function create(input: ColorInput): Promise<Color> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    // Auto-detect hex_code from COLOR_MAP if not provided
    const hex_code = input.hex_code || COLOR_MAP[input.name] || '#000000';

    const data = await vpsClient.post<ColorRow>('/table-data/colors', {
        company_id: companyId,
        name: input.name,
        slug,
        hex_code,
        active: input.active !== undefined ? input.active : true
    });

    clearListCache();
    return normalizeColor(data);
}

/**
 * Update existing color
 */
async function update(id: string, input: ColorInput): Promise<Color> {
    const slug = generateSlug(input.name);

    const data = await vpsClient.patch<ColorRow>(
        `/table-data/colors/${encodeURIComponent(id)}?pk=id`,
        stripUndefined({
            name: input.name,
            slug,
            hex_code: input.hex_code !== undefined ? input.hex_code : undefined,
            active: input.active !== undefined ? input.active : undefined
        })
    );

    clearListCache();
    return normalizeColor(data);
}

/**
 * Delete color
 */
async function deleteColor(id: string): Promise<void> {
    await vpsClient.delete(`/table-data/colors/${encodeURIComponent(id)}?pk=id`);
    clearListCache();
}

/**
 * Get only active colors
 */
async function listActive(): Promise<Color[]> {
    return (await list()).filter(color => color.active);
}

async function refreshActive(): Promise<Color[]> {
    clearListCache();
    return listActive();
}

/**
 * Get color hex code (from entity or COLOR_MAP)
 */
export function getColorHex(colorName: string): string | undefined {
    if (!colorName) return undefined;
    // Exact match first
    if (COLOR_MAP[colorName]) return COLOR_MAP[colorName];
    
    // Case-insensitive fallback
    const lowerName = colorName.toLowerCase().trim();
    const key = Object.keys(COLOR_MAP).find(k => k.toLowerCase().trim() === lowerName);
    return key ? COLOR_MAP[key] : undefined;
}

export const colorService = {
    list,
    getById,
    create,
    update,
    delete: deleteColor,
    listActive,
    refreshActive,
    getColorHex
};
