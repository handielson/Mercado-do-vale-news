
import { Ram, RamInput } from '../types/ram';

/**
 * RAM SERVICE
 * Complete CRUD operations with localStorage persistence
 * 
 * ANTIGRAVITY PROTOCOL:
 * - localStorage key: antigravity_rams_v1
 * - Auto-generate slugs from names
 * - Timestamp tracking (created, updated)
 * - Follows same pattern as brandService, colorService, and storageService
 * - Manages RAM memory capacities
 */

const RAM_KEY = 'antigravity_rams_v1';

// Default RAM capacities for initial setup
const defaultRams: Ram[] = [
    {
        id: 'ram-1',
        name: '2GB',
        slug: '2gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-2',
        name: '3GB',
        slug: '3gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-3',
        name: '4GB',
        slug: '4gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-4',
        name: '6GB',
        slug: '6gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-5',
        name: '8GB',
        slug: '8gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-6',
        name: '12GB',
        slug: '12gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-7',
        name: '16GB',
        slug: '16gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-8',
        name: '24GB',
        slug: '24gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'ram-9',
        name: '32GB',
        slug: '32gb',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

/**
 * Generate URL-friendly slug from RAM name
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
    return `ram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load RAMs from localStorage
 */
function loadFromStorage(): Ram[] {
    try {
        const stored = localStorage.getItem(RAM_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading RAMs from localStorage:', error);
    }
    return defaultRams;
}

/**
 * Save RAMs to localStorage
 */
function saveToStorage(rams: Ram[]): void {
    try {
        localStorage.setItem(RAM_KEY, JSON.stringify(rams));
    } catch (error) {
        console.error('Error saving RAMs to localStorage:', error);
    }
}

// Initialize RAMs from storage
let rams: Ram[] = loadFromStorage();

/**
 * RAM Service
 */
export const ramService = {
    /**
     * List all RAMs
     */
    async list(): Promise<Ram[]> {
        return Promise.resolve([...rams]);
    },

    /**
     * Get RAM by ID
     */
    async getById(id: string): Promise<Ram | null> {
        const ram = rams.find(r => r.id === id);
        return Promise.resolve(ram || null);
    },

    /**
     * Create new RAM
     */
    async create(input: RamInput): Promise<Ram> {
        const now = new Date().toISOString();
        const newRam: Ram = {
            id: generateId(),
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : true,
            created: now,
            updated: now
        };

        rams.push(newRam);
        saveToStorage(rams);

        return Promise.resolve(newRam);
    },

    /**
     * Update existing RAM
     */
    async update(id: string, input: RamInput): Promise<Ram> {
        const index = rams.findIndex(r => r.id === id);

        if (index === -1) {
            throw new Error(`RAM with id ${id} not found`);
        }

        const updated: Ram = {
            ...rams[index],
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : rams[index].active,
            updated: new Date().toISOString()
        };

        rams[index] = updated;
        saveToStorage(rams);

        return Promise.resolve(updated);
    },

    /**
     * Delete RAM
     */
    async delete(id: string): Promise<void> {
        rams = rams.filter(r => r.id !== id);
        saveToStorage(rams);
        return Promise.resolve();
    },

    /**
     * Get only active RAMs
     */
    async listActive(): Promise<Ram[]> {
        return Promise.resolve(rams.filter(r => r.active));
    }
};
