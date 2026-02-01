
import { Version, VersionInput } from '../types/version';

/**
 * VERSION SERVICE
 * Complete CRUD operations with localStorage persistence
 * 
 * ANTIGRAVITY PROTOCOL:
 * - localStorage key: antigravity_versions_v1
 * - Auto-generate slugs from names
 * - Timestamp tracking (created, updated)
 * - Manages product versions (iOS 17, Android 14, Global, etc.)
 */

const VERSION_KEY = 'antigravity_versions_v1';

// Default versions for initial setup
const defaultVersions: Version[] = [
    {
        id: 'version-1',
        name: 'Global',
        slug: 'global',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'version-2',
        name: 'China',
        slug: 'china',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'version-3',
        name: 'USA',
        slug: 'usa',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'version-4',
        name: 'Europa',
        slug: 'europa',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'version-5',
        name: 'Brasil',
        slug: 'brasil',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

/**
 * Generate URL-friendly slug from version name
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
    return `version-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load versions from localStorage
 */
function loadFromStorage(): Version[] {
    try {
        const stored = localStorage.getItem(VERSION_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading versions from localStorage:', error);
    }
    return defaultVersions;
}

/**
 * Save versions to localStorage
 */
function saveToStorage(versions: Version[]): void {
    try {
        localStorage.setItem(VERSION_KEY, JSON.stringify(versions));
    } catch (error) {
        console.error('Error saving versions to localStorage:', error);
    }
}

// Initialize versions from storage
let versions: Version[] = loadFromStorage();

/**
 * Version Service
 */
export const versionService = {
    /**
     * List all versions
     */
    async list(): Promise<Version[]> {
        return Promise.resolve([...versions]);
    },

    /**
     * Get version by ID
     */
    async getById(id: string): Promise<Version | null> {
        const version = versions.find(v => v.id === id);
        return Promise.resolve(version || null);
    },

    /**
     * Create new version
     */
    async create(input: VersionInput): Promise<Version> {
        const now = new Date().toISOString();
        const newVersion: Version = {
            id: generateId(),
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : true,
            created: now,
            updated: now
        };

        versions.push(newVersion);
        saveToStorage(versions);

        return Promise.resolve(newVersion);
    },

    /**
     * Update existing version
     */
    async update(id: string, input: VersionInput): Promise<Version> {
        const index = versions.findIndex(v => v.id === id);

        if (index === -1) {
            throw new Error(`Version with id ${id} not found`);
        }

        const updated: Version = {
            ...versions[index],
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : versions[index].active,
            updated: new Date().toISOString()
        };

        versions[index] = updated;
        saveToStorage(versions);

        return Promise.resolve(updated);
    },

    /**
     * Delete version
     */
    async delete(id: string): Promise<void> {
        versions = versions.filter(v => v.id !== id);
        saveToStorage(versions);
        return Promise.resolve();
    },

    /**
     * Get only active versions
     */
    async listActive(): Promise<Version[]> {
        return Promise.resolve(versions.filter(v => v.active));
    }
};
