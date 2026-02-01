
import { Model, ModelInput } from '../types/model';

/**
 * MODEL SERVICE
 * Complete CRUD operations with localStorage persistence
 * 
 * ANTIGRAVITY PROTOCOL:
 * - localStorage key: antigravity_models_v1
 * - Auto-generate slugs from names
 * - Timestamp tracking (created, updated)
 * - Follows same pattern as brandService
 * - Models are associated with brands
 */

const STORAGE_KEY = 'antigravity_models_v1';

// Default models for initial setup (associated with default brands)
const defaultModels: Model[] = [
    // Apple Models
    {
        id: 'model-1',
        name: 'iPhone 13',
        slug: 'iphone-13',
        brand_id: 'brand-1', // Apple
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'model-2',
        name: 'iPhone 14',
        slug: 'iphone-14',
        brand_id: 'brand-1', // Apple
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'model-3',
        name: 'iPhone 15',
        slug: 'iphone-15',
        brand_id: 'brand-1', // Apple
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    // Samsung Models
    {
        id: 'model-4',
        name: 'Galaxy S23',
        slug: 'galaxy-s23',
        brand_id: 'brand-2', // Samsung
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'model-5',
        name: 'Galaxy S24',
        slug: 'galaxy-s24',
        brand_id: 'brand-2', // Samsung
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    // Xiaomi Models
    {
        id: 'model-6',
        name: 'Redmi Note 12',
        slug: 'redmi-note-12',
        brand_id: 'brand-3', // Xiaomi
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

/**
 * Generate URL-friendly slug from model name
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
    return `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load models from localStorage
 */
function loadFromStorage(): Model[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading models from localStorage:', error);
    }
    return defaultModels;
}

/**
 * Save models to localStorage
 */
function saveToStorage(models: Model[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
    } catch (error) {
        console.error('Error saving models to localStorage:', error);
    }
}

// Initialize models from storage
let models: Model[] = loadFromStorage();

/**
 * Model Service
 */
export const modelService = {
    /**
     * List all models
     */
    async list(): Promise<Model[]> {
        return Promise.resolve([...models]);
    },

    /**
     * Get model by ID
     */
    async getById(id: string): Promise<Model | null> {
        const model = models.find(m => m.id === id);
        return Promise.resolve(model || null);
    },

    /**
     * Get models by brand ID
     */
    async listByBrand(brandId: string): Promise<Model[]> {
        return Promise.resolve(models.filter(m => m.brand_id === brandId && m.active));
    },

    /**
     * Create new model
     */
    async create(input: ModelInput): Promise<Model> {
        const now = new Date().toISOString();
        const newModel: Model = {
            id: generateId(),
            name: input.name,
            slug: generateSlug(input.name),
            brand_id: input.brand_id,
            active: input.active !== undefined ? input.active : true,
            created: now,
            updated: now
        };

        models.push(newModel);
        saveToStorage(models);

        return Promise.resolve(newModel);
    },

    /**
     * Update existing model
     */
    async update(id: string, input: ModelInput): Promise<Model> {
        const index = models.findIndex(m => m.id === id);

        if (index === -1) {
            throw new Error(`Model with id ${id} not found`);
        }

        const updated: Model = {
            ...models[index],
            name: input.name,
            slug: generateSlug(input.name),
            brand_id: input.brand_id,
            active: input.active !== undefined ? input.active : models[index].active,
            updated: new Date().toISOString()
        };

        models[index] = updated;
        saveToStorage(models);

        return Promise.resolve(updated);
    },

    /**
     * Delete model
     */
    async delete(id: string): Promise<void> {
        models = models.filter(m => m.id !== id);
        saveToStorage(models);
        return Promise.resolve();
    },

    /**
     * Get only active models
     */
    async listActive(): Promise<Model[]> {
        return Promise.resolve(models.filter(m => m.active));
    },

    /**
     * Get active models by brand
     */
    async listActiveByBrand(brandId: string): Promise<Model[]> {
        return Promise.resolve(models.filter(m => m.brand_id === brandId && m.active));
    }
};
