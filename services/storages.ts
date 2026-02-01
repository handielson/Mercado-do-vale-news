
import { Storage, StorageInput } from '../types/storage';

/**
 * STORAGE SERVICE
 * Complete CRUD operations with localStorage persistence
 * 
 * ANTIGRAVITY PROTOCOL:
 * - localStorage key: antigravity_storages_v1
 * - Auto-generate slugs from names
 * - Timestamp tracking (created, updated)
 * - Follows same pattern as brandService and colorService
 * - Manages storage capacities (64GB, 128GB, 256GB, etc.)
 */

const STORAGE_KEY = 'antigravity_storages_v1';

// Default storage capacities for initial setup
const defaultStorages: Storage[] = [
    {
        id: 'storage-1',
        name: '64GB',
        slug: '64gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-2',
        name: '128GB',
        slug: '128gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-3',
        name: '256GB',
        slug: '256gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-4',
        name: '512GB',
        slug: '512gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-5',
        name: '1TB',
        slug: '1tb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-6',
        name: '2TB',
        slug: '2tb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-7',
        name: '4GB',
        slug: '4gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-8',
        name: '6GB',
        slug: '6gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-9',
        name: '8GB',
        slug: '8gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-10',
        name: '12GB',
        slug: '12gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'storage-11',
        name: '16GB',
        slug: '16gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

/**
 * Generate URL-friendly slug from storage name
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
    return `storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load storages from localStorage
 */
function loadFromStorage(): Storage[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading storages from localStorage:', error);
    }
    return defaultStorages;
}

/**
 * Save storages to localStorage
 */
function saveToStorage(storages: Storage[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storages));
    } catch (error) {
        console.error('Error saving storages to localStorage:', error);
    }
}

// Initialize storages from storage
let storages: Storage[] = loadFromStorage();

/**
 * Storage Service
 */
export const storageService = {
    /**
     * List all storages
     */
    async list(): Promise<Storage[]> {
        return Promise.resolve([...storages]);
    },

    /**
     * Get storage by ID
     */
    async getById(id: string): Promise<Storage | null> {
        const storage = storages.find(s => s.id === id);
        return Promise.resolve(storage || null);
    },

    /**
     * Create new storage
     */
    async create(input: StorageInput): Promise<Storage> {
        const now = new Date().toISOString();
        const newStorage: Storage = {
            id: generateId(),
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : true,
            created: now,
            updated: now
        };

        storages.push(newStorage);
        saveToStorage(storages);

        return Promise.resolve(newStorage);
    },

    /**
     * Update existing storage
     */
    async update(id: string, input: StorageInput): Promise<Storage> {
        const index = storages.findIndex(s => s.id === id);

        if (index === -1) {
            throw new Error(`Storage with id ${id} not found`);
        }

        const updated: Storage = {
            ...storages[index],
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : storages[index].active,
            updated: new Date().toISOString()
        };

        storages[index] = updated;
        saveToStorage(storages);

        return Promise.resolve(updated);
    },

    /**
     * Delete storage
     */
    async delete(id: string): Promise<void> {
        storages = storages.filter(s => s.id !== id);
        saveToStorage(storages);
        return Promise.resolve();
    },

    /**
     * Get only active storages
     */
    async listActive(): Promise<Storage[]> {
        return Promise.resolve(storages.filter(s => s.active));
    }
};
