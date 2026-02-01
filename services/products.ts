
import { pb } from './pb';
import { Product, ProductInput } from '../types/product';
import { ProductStatus } from '../utils/field-standards';
import { validateProduct } from '../schemas/product';

/**
 * PRODUCT SERVICE
 * Hybrid service layer with localStorage persistence
 * Data survives page refreshes in DEV_MODE
 */

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';
const STORAGE_KEY = 'antigravity_products_v1';

// Default mock products (used as fallback)
const defaultProducts: Product[] = [
    {
        id: 'mock-1',
        category_id: 'cat-1', // Celulares
        brand: 'Apple',
        model: 'iPhone 13',
        name: 'iPhone 13 128GB Azul',
        sku: 'APPLE-IP13-128-BLUE',
        price_retail: 399900,      // R$ 3.999,00
        price_reseller: 379900,    // R$ 3.799,00
        price_wholesale: 359900,   // R$ 3.599,00
        images: [
            'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=400'
        ],
        eans: ['7891234567890'],
        specs: {
            storage: '128GB',
            ram: '4GB',
            color: 'Azul',
            display: '6.1"',
            network: '5G'
        },
        status: ProductStatus.ACTIVE,
        created: new Date('2024-01-15').toISOString(),
        updated: new Date('2024-01-15').toISOString()
    },
    {
        id: 'mock-2',
        category_id: 'cat-3', // Acessórios
        brand: 'Generic',
        model: 'Silicone Case',
        name: 'Capa Silicone iPhone 13 - Preta',
        sku: 'ACC-CASE-IP13-BLK',
        price_retail: 4900,        // R$ 49,00
        price_reseller: 3900,      // R$ 39,00
        price_wholesale: 2900,     // R$ 29,00
        images: [],
        eans: ['7891234567892'],
        specs: {
            color: 'Preta',
            material: 'Silicone'
        },
        status: ProductStatus.ACTIVE,
        created: new Date('2024-01-18').toISOString(),
        updated: new Date('2024-01-18').toISOString()
    }
];

/**
 * Load products from localStorage
 */
function loadFromStorage(): Product[] {
    if (!DEV_MODE) return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const products = JSON.parse(stored);
            console.log('📦 Loaded products from localStorage:', products.length);
            return products;
        }
    } catch (error) {
        console.error('Error loading products from localStorage:', error);
    }

    // First time: save defaults and return them
    console.log('🔧 Initializing localStorage with default products');
    saveToStorage(defaultProducts);
    return defaultProducts;
}

/**
 * Save products to localStorage
 */
function saveToStorage(products: Product[]): void {
    if (!DEV_MODE) return;

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
        console.log('💾 Saved products to localStorage:', products.length);
    } catch (error) {
        console.error('Error saving products to localStorage:', error);
    }
}

/**
 * Delay helper for simulating async operations
 */
const delay = () => new Promise(resolve => setTimeout(resolve, 300));

/**
 * List all products
 */
async function list(): Promise<Product[]> {
    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Fetching products from localStorage');
        await delay();
        return loadFromStorage();
    }

    try {
        const products = await pb.collection('products').getFullList<Product>();
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

/**
 * Get product by ID
 */
async function getById(id: string): Promise<Product> {
    if (DEV_MODE) {
        console.log(`🔧 DEV MODE: Fetching product ${id} from localStorage`);
        await delay();
        const products = loadFromStorage();
        const product = products.find(p => p.id === id);
        if (!product) {
            throw new Error('Produto não encontrado');
        }
        return product;
    }

    try {
        const product = await pb.collection('products').getOne<Product>(id);
        return product;
    } catch (error) {
        console.error('Error fetching product:', error);
        throw new Error('Produto não encontrado');
    }
}

/**
 * Create new product
 */
async function create(input: ProductInput): Promise<Product> {
    // Validate input
    const validation = validateProduct(input);
    if (!validation.success) {
        throw new Error('Dados inválidos: ' + validation.error);
    }

    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Creating product', input);
        await delay();

        const products = loadFromStorage();
        const newProduct: Product = {
            id: `prod-${Date.now()}`,
            ...input,
            images: input.images || [],
            eans: input.eans || [],
            specs: input.specs || {},
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        products.push(newProduct);
        saveToStorage(products);
        return newProduct;
    }

    try {
        const record = await pb.collection('products').create(input);
        return record as unknown as Product;
    } catch (error) {
        console.error('Error creating product:', error);
        throw new Error('Erro ao criar produto');
    }
}

/**
 * Update existing product
 */
async function update(id: string, input: ProductInput): Promise<Product> {
    // Validate input
    const validation = validateProduct(input);
    if (!validation.success) {
        throw new Error('Dados inválidos: ' + validation.error);
    }

    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Updating product', id, input);
        await delay();

        const products = loadFromStorage();
        const index = products.findIndex(p => p.id === id);
        if (index === -1) {
            throw new Error('Produto não encontrado');
        }

        const updatedProduct: Product = {
            ...products[index],
            ...input,
            updated: new Date().toISOString()
        };

        products[index] = updatedProduct;
        saveToStorage(products);
        return updatedProduct;
    }

    try {
        const record = await pb.collection('products').update(id, input);
        return record as unknown as Product;
    } catch (error) {
        console.error('Error updating product:', error);
        throw new Error('Erro ao atualizar produto');
    }
}

/**
 * Delete product
 */
async function remove(id: string): Promise<void> {
    if (DEV_MODE) {
        console.log('🔧 DEV MODE: Deleting product', id);
        await delay();

        const products = loadFromStorage();
        const filtered = products.filter(p => p.id !== id);
        saveToStorage(filtered);
        return;
    }

    try {
        await pb.collection('products').delete(id);
    } catch (error) {
        console.error('Error deleting product:', error);
        throw new Error('Erro ao deletar produto');
    }
}

/**
 * Find product by EAN barcode
 */
async function findByEAN(ean: string): Promise<Product | null> {
    if (!ean || ean.length !== 13) {
        return null;
    }

    if (DEV_MODE) {
        console.log(`🔧 DEV MODE: Searching product by EAN ${ean}`);
        await delay();
        const products = loadFromStorage();
        const product = products.find(p => p.eans && p.eans.includes(ean));
        return product || null;
    }

    try {
        // Search for product with this EAN in the array
        const products = await pb.collection('products').getFullList<Product>({
            filter: `eans ~ "${ean}"`
        });
        return products.length > 0 ? products[0] : null;
    } catch (error) {
        console.error('Error searching product by EAN:', error);
        return null;
    }
}

/**
 * Get price statistics for a product (last purchase price and average stock price)
 */
async function getPriceStats(productId: string): Promise<{
    lastPurchasePrice: number | null;
    averageStockPrice: number | null;
}> {
    // TODO: Implement when inventory/purchase history is available
    return {
        lastPurchasePrice: null,
        averageStockPrice: null
    };
}

export const productService = {
    list,
    getById,
    findByEAN,
    getPriceStats,
    create,
    update,
    remove
};
