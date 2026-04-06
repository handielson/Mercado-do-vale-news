
import { Color, ColorInput } from '../types/color';
import { supabase } from './supabase';

/**
 * COLOR SERVICE - Supabase Implementation
 * Multi-tenant service with Row Level Security
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Online storage via Supabase (not localStorage)
 * - Multi-tenant with company_id isolation
 * - Follows same pattern as brandService
 * - Includes hex_code mapping for visual preview
 */

// TEMPORARY: Hardcoded company_id until we implement auth
const TEMP_COMPANY_ID = 'mercado-do-vale';

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
 * Get company_id from companies table by slug
 */
async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', TEMP_COMPANY_ID)
        .single();

    if (error) throw new Error(`Failed to get company: ${error.message}`);
    return data.id;
}

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

/**
 * List all colors
 */
async function list(): Promise<Color[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('colors')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

    if (error) throw new Error(`Failed to fetch colors: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        hex_code: row.hex_code,
        active: row.active ?? true,
        created: row.created_at,
        updated: row.updated_at
    }));
}

/**
 * Get color by ID
 */
async function getById(id: string): Promise<Color | null> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('colors')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to fetch color: ${error.message}`);
    }

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        hex_code: data.hex_code,
        active: data.active ?? true,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Create new color
 */
async function create(input: ColorInput): Promise<Color> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    // Auto-detect hex_code from COLOR_MAP if not provided
    const hex_code = input.hex_code || COLOR_MAP[input.name] || '#000000';

    const { data, error } = await supabase
        .from('colors')
        .insert({
            company_id: companyId,
            name: input.name,
            slug,
            hex_code,
            active: input.active !== undefined ? input.active : true
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create color: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        hex_code: data.hex_code,
        active: data.active,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Update existing color
 */
async function update(id: string, input: ColorInput): Promise<Color> {
    const companyId = await getCompanyId();
    const slug = generateSlug(input.name);

    const { data, error } = await supabase
        .from('colors')
        .update({
            name: input.name,
            slug,
            hex_code: input.hex_code !== undefined ? input.hex_code : undefined,
            active: input.active !== undefined ? input.active : undefined
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) throw new Error(`Failed to update color: ${error.message}`);

    return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        hex_code: data.hex_code,
        active: data.active,
        created: data.created_at,
        updated: data.updated_at
    };
}

/**
 * Delete color
 */
async function deleteColor(id: string): Promise<void> {
    const companyId = await getCompanyId();

    const { error } = await supabase
        .from('colors')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);

    if (error) throw new Error(`Failed to delete color: ${error.message}`);
}

/**
 * Get only active colors
 */
async function listActive(): Promise<Color[]> {
    const companyId = await getCompanyId();

    const { data, error } = await supabase
        .from('colors')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

    if (error) throw new Error(`Failed to fetch active colors: ${error.message}`);

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        hex_code: row.hex_code,
        active: row.active,
        created: row.created_at,
        updated: row.updated_at
    }));
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
    getColorHex
};
