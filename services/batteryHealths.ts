
import { BatteryHealth, BatteryHealthInput } from '../types/batteryHealth';

/**
 * BATTERY HEALTH SERVICE
 * Complete CRUD operations with localStorage persistence
 * 
 * ANTIGRAVITY PROTOCOL:
 * - localStorage key: antigravity_battery_healths_v1
 * - Auto-generate slugs from names
 * - Timestamp tracking (created, updated)
 * - Manages battery health percentages
 */

const BATTERY_HEALTH_KEY = 'antigravity_battery_healths_v1';

// Default battery health percentages for initial setup
const defaultBatteryHealths: BatteryHealth[] = [
    {
        id: 'battery-1',
        name: '100%',
        slug: '100',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'battery-2',
        name: '95%',
        slug: '95',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'battery-3',
        name: '90%',
        slug: '90',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'battery-4',
        name: '85%',
        slug: '85',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'battery-5',
        name: '80%',
        slug: '80',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'battery-6',
        name: '75%',
        slug: '75',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'battery-7',
        name: '70%',
        slug: '70',
        active: true,
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

/**
 * Generate URL-friendly slug from battery health name
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
    return `battery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Load battery healths from localStorage
 */
function loadFromStorage(): BatteryHealth[] {
    try {
        const stored = localStorage.getItem(BATTERY_HEALTH_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading battery healths from localStorage:', error);
    }
    return defaultBatteryHealths;
}

/**
 * Save battery healths to localStorage
 */
function saveToStorage(batteryHealths: BatteryHealth[]): void {
    try {
        localStorage.setItem(BATTERY_HEALTH_KEY, JSON.stringify(batteryHealths));
    } catch (error) {
        console.error('Error saving battery healths to localStorage:', error);
    }
}

// Initialize battery healths from storage
let batteryHealths: BatteryHealth[] = loadFromStorage();

/**
 * Battery Health Service
 */
export const batteryHealthService = {
    /**
     * List all battery healths
     */
    async list(): Promise<BatteryHealth[]> {
        return Promise.resolve([...batteryHealths]);
    },

    /**
     * Get battery health by ID
     */
    async getById(id: string): Promise<BatteryHealth | null> {
        const batteryHealth = batteryHealths.find(bh => bh.id === id);
        return Promise.resolve(batteryHealth || null);
    },

    /**
     * Create new battery health
     */
    async create(input: BatteryHealthInput): Promise<BatteryHealth> {
        const now = new Date().toISOString();
        const newBatteryHealth: BatteryHealth = {
            id: generateId(),
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : true,
            created: now,
            updated: now
        };

        batteryHealths.push(newBatteryHealth);
        saveToStorage(batteryHealths);

        return Promise.resolve(newBatteryHealth);
    },

    /**
     * Update existing battery health
     */
    async update(id: string, input: BatteryHealthInput): Promise<BatteryHealth> {
        const index = batteryHealths.findIndex(bh => bh.id === id);

        if (index === -1) {
            throw new Error(`Battery health with id ${id} not found`);
        }

        const updated: BatteryHealth = {
            ...batteryHealths[index],
            name: input.name,
            slug: generateSlug(input.name),
            active: input.active !== undefined ? input.active : batteryHealths[index].active,
            updated: new Date().toISOString()
        };

        batteryHealths[index] = updated;
        saveToStorage(batteryHealths);

        return Promise.resolve(updated);
    },

    /**
     * Delete battery health
     */
    async delete(id: string): Promise<void> {
        batteryHealths = batteryHealths.filter(bh => bh.id !== id);
        saveToStorage(batteryHealths);
        return Promise.resolve();
    },

    /**
     * Get only active battery healths
     */
    async listActive(): Promise<BatteryHealth[]> {
        return Promise.resolve(batteryHealths.filter(bh => bh.active));
    }
};
