
import { Color, ColorInput } from '../types/color';

/**
 * COLOR SERVICE
 * Complete CRUD operations with localStorage persistence
 * 
 * ANTIGRAVITY PROTOCOL:
 * - localStorage key: antigravity_colors_v1
 * - Auto-generate slugs from names
 * - Timestamp tracking (created, updated)
 * - Follows same pattern as brandService
 * - Includes hex_code mapping for visual preview
 */

const STORAGE_KEY = 'antigravity_colors_v1';

// Color mapping for visual preview
export const COLOR_MAP: Record<string, string> = {
    'Preto': '#000000',
    'Branco': '#FFFFFF',
    'Azul': '#3B82F6',
    'Verde': '#10B981',
    'Vermelho': '#EF4444',
    'Rosa': '#EC4899',
    'Dourado': '#F59E0B',
    'Prata': '#9CA3AF',
    'Cinza': '#6B7280',
    'Roxo': '#8B5CF6',
    'Amarelo': '#EAB308',
    'Laranja': '#F97316'
};

// Default colors for initial setup
const defaultColors: Color[] = [
    {
        id: 'color-1',
        name: 'Preto',
        slug: 'preto',
        hex_code: '#000000',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-2',
        name: 'Branco',
        slug: 'branco',
        hex_code: '#FFFFFF',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-3',
        name: 'Azul',
        slug: 'azul',
        hex_code: '#3B82F6',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-4',
        name: 'Verde',
        slug: 'verde',
        hex_code: '#10B981',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-5',
        name: 'Vermelho',
        slug: 'vermelho',
        hex_code: '#EF4444',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-6',
        name: 'Rosa',
        slug: 'rosa',
        hex_code: '#EC4899',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-7',
        name: 'Dourado',
        slug: 'dourado',
        hex_code: '#F59E0B',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-8',
        name: 'Prata',
        slug: 'prata',
        hex_code: '#9CA3AF',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-9',
        name: 'Cinza',
        slug: 'cinza',
        hex_code: '#6B7280',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'color-10',
        name: 'Roxo',
        slug: 'roxo',
        hex_code: '#8B5CF6',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

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
 * Generate unique ID
 */
function generateId(): string {
    return `color-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load colors from localStorage
 */
function loadFromStorage(): Color[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading colors from localStorage:', error);
    }
    return defaultColors;
}

/**
 * Save colors to localStorage
 */
function saveToStorage(colors: Color[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    } catch (error) {
        console.error('Error saving colors to localStorage:', error);
    }
}

// Initialize colors from storage
let colors: Color[] = loadFromStorage();

/**
 * Color Service
 */
export const colorService = {
    /**
     * List all colors
     */
    async list(): Promise<Color[]> {
        return Promise.resolve([...colors]);
    },

    /**
     * Get color by ID
     */
    async getById(id: string): Promise<Color | null> {
        const color = colors.find(c => c.id === id);
        return Promise.resolve(color || null);
    },

    /**
     * Create new color
     */
    async create(input: ColorInput): Promise<Color> {
        const now = new Date().toISOString();

        // Auto-detect hex_code from COLOR_MAP if not provided
        const hex_code = input.hex_code || COLOR_MAP[input.name];

        const newColor: Color = {
            id: generateId(),
            name: input.name,
            slug: generateSlug(input.name),
            hex_code,
            active: input.active !== undefined ? input.active : true,
            created: now,
            updated: now
        };

        colors.push(newColor);
        saveToStorage(colors);

        return Promise.resolve(newColor);
    },

    /**
     * Update existing color
     */
    async update(id: string, input: ColorInput): Promise<Color> {
        const index = colors.findIndex(c => c.id === id);

        if (index === -1) {
            throw new Error(`Color with id ${id} not found`);
        }

        const updated: Color = {
            ...colors[index],
            name: input.name,
            slug: generateSlug(input.name),
            hex_code: input.hex_code !== undefined ? input.hex_code : colors[index].hex_code,
            active: input.active !== undefined ? input.active : colors[index].active,
            updated: new Date().toISOString()
        };

        colors[index] = updated;
        saveToStorage(colors);

        return Promise.resolve(updated);
    },

    /**
     * Delete color
     */
    async delete(id: string): Promise<void> {
        colors = colors.filter(c => c.id !== id);
        saveToStorage(colors);
        return Promise.resolve();
    },

    /**
     * Get only active colors
     */
    async listActive(): Promise<Color[]> {
        return Promise.resolve(colors.filter(c => c.active));
    },

    /**
     * Get color hex code (from entity or COLOR_MAP)
     */
    getColorHex(colorName: string): string | undefined {
        const color = colors.find(c => c.name === colorName);
        return color?.hex_code || COLOR_MAP[colorName];
    }
};
