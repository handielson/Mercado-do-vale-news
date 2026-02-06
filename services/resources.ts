
/**
 * RESOURCE SERVICES
 * Centralized service for managing auxiliary resources (brands, models, colors)
 * Hybrid pattern: Mock data in DEV, Supabase in PROD
 */

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// Mock data
let mockBrands = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'LG'];
let mockModels = ['iPhone 13', 'iPhone 14', 'Galaxy S23', 'Redmi Note 12', 'Moto G'];
let mockColors = ['Preto', 'Branco', 'Azul', 'Verde', 'Vermelho', 'Rosa', 'Dourado', 'Prata'];

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
    'Roxo': '#8B5CF6'
};

const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Brand Service
 */
export const brandService = {
    async list(): Promise<string[]> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Fetching brands');
            await delay();
            return [...mockBrands];
        }
        // TODO: Supabase integration
        return mockBrands;
    },

    async create(name: string): Promise<string> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Creating brand:', name);
            await delay();
            if (!mockBrands.includes(name)) {
                mockBrands.push(name);
            }
            return name;
        }
        // TODO: Supabase integration
        return name;
    }
};

/**
 * Model Service
 */
export const modelService = {
    async list(): Promise<string[]> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Fetching models');
            await delay();
            return [...mockModels];
        }
        // TODO: Supabase integration
        return mockModels;
    },

    async create(name: string): Promise<string> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Creating model:', name);
            await delay();
            if (!mockModels.includes(name)) {
                mockModels.push(name);
            }
            return name;
        }
        // TODO: Supabase integration
        return name;
    }
};

/**
 * Color Service
 */
export const colorService = {
    async list(): Promise<string[]> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Fetching colors');
            await delay();
            return [...mockColors];
        }
        // TODO: Supabase integration
        return mockColors;
    },

    async create(name: string): Promise<string> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Creating color:', name);
            await delay();
            if (!mockColors.includes(name)) {
                mockColors.push(name);
            }
            return name;
        }
        // TODO: Supabase integration
        return name;
    },

    getColorHex(colorName: string): string | undefined {
        return COLOR_MAP[colorName];
    }
};

// Mock data for capacities and versions
let mockCapacities = ['64GB', '128GB', '256GB', '512GB', '1TB', '2GB', '4GB', '6GB', '8GB', '12GB', '16GB'];
let mockVersions = ['Global', 'China', 'USA', 'Europa', 'Dual SIM', 'eSIM'];

/**
 * Capacity Service (Storage/RAM)
 */
export const capacityService = {
    async list(): Promise<string[]> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Fetching capacities');
            await delay();
            return [...mockCapacities];
        }
        // TODO: Supabase integration
        return mockCapacities;
    },

    async create(name: string): Promise<string> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Creating capacity:', name);
            await delay();
            if (!mockCapacities.includes(name)) {
                mockCapacities.push(name);
            }
            return name;
        }
        // TODO: Supabase integration
        return name;
    }
};

/**
 * Version Service (Regional variants)
 */
export const versionService = {
    async list(): Promise<string[]> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Fetching versions');
            await delay();
            return [...mockVersions];
        }
        // TODO: Supabase integration
        return mockVersions;
    },

    async create(name: string): Promise<string> {
        if (DEV_MODE) {
            console.log('🔧 DEV MODE: Creating version:', name);
            await delay();
            if (!mockVersions.includes(name)) {
                mockVersions.push(name);
            }
            return name;
        }
        // TODO: Supabase integration
        return name;
    }
};
