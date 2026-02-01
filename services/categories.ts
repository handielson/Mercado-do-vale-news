
import { Category, CategoryInput } from '../types/category';
import { pb } from './pb';

/**
 * CATEGORY SERVICE
 * Hybrid service layer with localStorage persistence
 * Data survives page refreshes in DEV_MODE
 */

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const STORAGE_KEY = 'antigravity_categories_v1';

// Default mock categories (used as fallback)
const defaultCategories: Category[] = [
    {
        id: 'cat-1',
        name: 'Celulares',
        slug: 'phones',
        config: {
            imei1: 'required',
            imei2: 'optional',
            serial: 'optional',
            color: 'required',
            storage: 'required',
            ram: 'required',
            version: 'optional',
            battery_health: 'required',
            custom_fields: []
        },
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'cat-2',
        name: 'Tablets',
        slug: 'tablets',
        config: {
            imei1: 'optional',
            imei2: 'off',
            serial: 'required',
            color: 'required',
            storage: 'required',
            ram: 'optional',
            version: 'optional',
            battery_health: 'required',
            custom_fields: []
        },
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    },
    {
        id: 'cat-3',
        name: 'Acessórios',
        slug: 'accessories',
        config: {
            imei1: 'off',
            imei2: 'off',
            serial: 'off',
            color: 'optional',
            storage: 'off',
            ram: 'off',
            version: 'off',
            battery_health: 'off',
            custom_fields: []
        },
        created: new Date('2024-01-01').toISOString(),
        updated: new Date('2024-01-01').toISOString()
    }
];

/**
 * Load categories from localStorage
 */
function loadFromStorage(): Category[] {
    if (!DEV_MODE) return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const categories = JSON.parse(stored);
            console.log('📦 Loaded categories from localStorage:', categories.length);
            return categories;
        }
    } catch (error) {
        console.error('Error loading categories from localStorage:', error);
    }

    // First time: save defaults and return them
    console.log('🔧 Initializing localStorage with default categories');
    saveToStorage(defaultCategories);
    return defaultCategories;
}

/**
 * Save categories to localStorage
 */
function saveToStorage(categories: Category[]): void {
    if (!DEV_MODE) return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
        console.log('💾 Saved categories to localStorage:', categories.length);
    } catch (error) {
        console.error('Error saving categories to localStorage:', error);
    }
}

/**
 * Delay helper for simulating async operations
 */
const delay = () => new Promise(resolve => setTimeout(resolve, 300));

/**
 * Generate slug from name
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
 * List all categories
 */
async function list(): Promise<Category[]> {
    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Fetching categories from localStorage');
        await delay();
        return loadFromStorage();
    }

    try {
        const resultList = await pb.collection('categories').getFullList<Category>();
        return resultList;
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}

/**
 * Create new category
 */
async function create(input: CategoryInput): Promise<Category> {
    const slug = input.slug || generateSlug(input.name);

    const data: CategoryInput = {
        name: input.name,
        slug,
        config: input.config
    };

    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Creating category', data);
        await delay();

        const categories = loadFromStorage();
        const newCategory: Category = {
            id: `cat-${Date.now()}`,
            name: data.name,
            slug: data.slug!,
            config: data.config,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        categories.push(newCategory);
        saveToStorage(categories);
        return newCategory;
    }

    try {
        const record = await pb.collection('categories').create(data);
        return record as unknown as Category;
    } catch (error) {
        console.error('Error creating category:', error);
        throw new Error('Erro ao criar categoria');
    }
}

/**
 * Get category by ID
 */
async function getById(id: string): Promise<Category> {
    if (DEV_MODE) {
        console.log(`🔧 DEV MODE: Fetching category ${id} from localStorage`);
        await delay();
        const categories = loadFromStorage();
        const category = categories.find(c => c.id === id);
        if (!category) {
            throw new Error('Categoria não encontrada');
        }
        return category;
    }

    try {
        const record = await pb.collection('categories').getOne(id);
        return record as unknown as Category;
    } catch (error) {
        console.error('Error fetching category:', error);
        throw new Error('Erro ao carregar categoria');
    }
}

/**
 * Update existing category
 */
async function update(id: string, input: CategoryInput): Promise<Category> {
    const slug = input.slug || generateSlug(input.name);

    const data: CategoryInput = {
        name: input.name,
        slug,
        config: input.config
    };

    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Updating category', id, data);
        await delay();

        const categories = loadFromStorage();
        const index = categories.findIndex(c => c.id === id);
        if (index === -1) {
            throw new Error('Categoria não encontrada');
        }

        const updatedCategory: Category = {
            ...categories[index],
            name: data.name,
            slug: data.slug!,
            config: data.config,
            updated: new Date().toISOString()
        };

        categories[index] = updatedCategory;
        saveToStorage(categories);
        return updatedCategory;
    }

    try {
        const record = await pb.collection('categories').update(id, data);
        return record as unknown as Category;
    } catch (error) {
        console.error('Error updating category:', error);
        throw new Error('Erro ao atualizar categoria');
    }
}

export const categoryService = {
    list,
    create,
    getById,
    update
};
