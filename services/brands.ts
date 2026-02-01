
import { Brand, BrandInput } from '../types/brand';

/**
 * BRAND SERVICE
 * Complete CRUD operations with localStorage persistence
 * 
 * ANTIGRAVITY PROTOCOL:
 * - localStorage key: antigravity_brands_v1
 * - Auto-generate slugs from names
 * - Timestamp tracking (created, updated)
 * - Follows same pattern as categoryService
 */

const STORAGE_KEY = 'antigravity_brands_v1';

// Default brands for initial setup
const defaultBrands: Brand[] = [
    {
        id: 'brand-1',
        name: 'Apple',
        slug: 'apple',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'brand-2',
        name: 'Samsung',
        slug: 'samsung',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'brand-3',
        name: 'Xiaomi',
        slug: 'xiaomi',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'brand-4',
        name: 'Motorola',
        slug: 'motorola',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'brand-5',
        name: 'LG',
        slug: 'lg',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'brand-6',
        name: 'Asus',
        slug: 'asus',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'brand-7',
        name: 'Dell',
        slug: 'dell',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'brand-8',
        name: 'HP',
        slug: 'hp',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

/**
 * Generate URL-friendly slug from brand name
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
    return `brand-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load brands from localStorage
 */
function loadFromStorage(): Brand[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading brands from localStorage:', error);
    }
    return defaultBrands;
}

/**
 * Save brands to localStorage
 */
function saveToStorage(brands: Brand[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(brands));
    } catch (error) {
        console.error('Error saving brands to localStorage:', error);
    }
}

// Initialize brands from storage
let brands: Brand[] = loadFromStorage();

/**
 * Brand Service
 */
export const brandService = {
    /**
     * List all brands
     */
    async list(): Promise<Brand[]> {
        return Promise.resolve([...brands]);
    },

    /**
     * Get brand by ID
     */
    async getById(id: string): Promise<Brand | null> {
        const brand = brands.find(b => b.id === id);
        return Promise.resolve(brand || null);
    },

    /**
     * Create new brand
     */
    async create(input: BrandInput): Promise<Brand> {
        const now = new Date().toISOString();
        const newBrand: Brand = {
            id: generateId(),
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : true,
            logo_url: input.logo_url,
            created: now,
            updated: now
        };

        brands.push(newBrand);
        saveToStorage(brands);

        return Promise.resolve(newBrand);
    },

    /**
     * Update existing brand
     */
    async update(id: string, input: BrandInput): Promise<Brand> {
        const index = brands.findIndex(b => b.id === id);

        if (index === -1) {
            throw new Error(`Brand with id ${id} not found`);
        }

        const updated: Brand = {
            ...brands[index],
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : brands[index].active,
            logo_url: input.logo_url !== undefined ? input.logo_url : brands[index].logo_url,
            updated: new Date().toISOString()
        };

        brands[index] = updated;
        saveToStorage(brands);

        return Promise.resolve(updated);
    },

    /**
     * Delete brand
     */
    async delete(id: string): Promise<void> {
        brands = brands.filter(b => b.id !== id);
        saveToStorage(brands);
        return Promise.resolve();
    },

    /**
     * Get only active brands
     */
    async listActive(): Promise<Brand[]> {
        return Promise.resolve(brands.filter(b => b.active));
    }
};
