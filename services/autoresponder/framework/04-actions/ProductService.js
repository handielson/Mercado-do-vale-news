let pool = null;

/**
 * Initializes the database pool reference.
 * @param {object} mysqlPool 
 */
export function init(mysqlPool) {
    pool = mysqlPool;
}

/**
 * Formats standard error response
 */
function errorResponse(code, message) {
    return {
        success: false,
        error: { code, message }
    };
}

/**
 * Formats standard success response
 */
function successResponse(data) {
    return {
        success: true,
        data
    };
}

/**
 * Checks if the db pool is ready.
 */
function checkPool() {
    if (!pool) {
        throw new Error('DATABASE_POOL_NOT_INITIALIZED');
    }
}

/**
 * Fetch a single product by ID or SKU.
 */
export async function getProduct(productId) {
    try {
        checkPool();
        const query = 'SELECT id, name, sku, price, stock_quantity FROM products WHERE id = ? OR sku = ? LIMIT 1';
        const [rows] = await pool.query(query, [productId, productId]);
        if (rows && rows.length > 0) {
            return successResponse(rows[0]);
        }
        return errorResponse('PRODUCT_NOT_FOUND', 'Produto não localizado.');
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

/**
 * Get lists of active catalog products.
 */
export async function getCatalog() {
    try {
        checkPool();
        const query = 'SELECT id, name, sku, price FROM products WHERE stock_quantity > 0 AND active = 1';
        const [rows] = await pool.query(query);
        return successResponse(rows || []);
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

/**
 * Get category details.
 */
export async function getCategory(categoryId) {
    try {
        checkPool();
        const query = 'SELECT id, name, slug FROM categories WHERE id = ? OR slug = ? LIMIT 1';
        const [rows] = await pool.query(query, [categoryId, categoryId]);
        if (rows && rows.length > 0) {
            return successResponse(rows[0]);
        }
        return errorResponse('CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

/**
 * Get product technical specifications.
 */
export async function getSpecifications(productId) {
    try {
        checkPool();
        const query = 'SELECT product_id, spec_name, spec_value FROM product_specifications WHERE product_id = ?';
        const [rows] = await pool.query(query, [productId]);
        return successResponse(rows || []);
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

/**
 * Get compatible accessories.
 */
export async function getCompatibleAccessories(productId, selectedMemory, selectedColor) {
    try {
        checkPool();
        let query = `
            SELECT p.id, p.name, p.price 
            FROM products p 
            JOIN product_compatibilities c ON p.id = c.accessory_id 
            WHERE c.product_id = ?
        `;
        const values = [productId];
        if (selectedMemory) {
            query += ' AND (c.memory = ? OR c.memory IS NULL)';
            values.push(selectedMemory);
        }
        if (selectedColor) {
            query += ' AND (c.color = ? OR c.color IS NULL)';
            values.push(selectedColor);
        }
        const [rows] = await pool.query(query, values);
        return successResponse(rows || []);
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

/**
 * Search products based on brand, model, memory, category, price range, and availability.
 */
export async function findProducts(filters = {}) {
    try {
        checkPool();
        let query = 'SELECT id, name, sku, price, stock_quantity FROM products WHERE active = 1';
        const values = [];

        if (filters.brand) {
            query += ' AND brand = ?';
            values.push(filters.brand);
        }
        if (filters.model) {
            query += ' AND model = ?';
            values.push(filters.model);
        }
        if (filters.memory) {
            query += ' AND memory = ?';
            values.push(filters.memory);
        }
        if (filters.category_id) {
            query += ' AND category_id = ?';
            values.push(filters.category_id);
        }
        if (filters.min_price) {
            query += ' AND price >= ?';
            values.push(filters.min_price);
        }
        if (filters.max_price) {
            query += ' AND price <= ?';
            values.push(filters.max_price);
        }
        if (filters.available_only) {
            query += ' AND stock_quantity > 0';
        }

        const [rows] = await pool.query(query, values);
        return successResponse(rows || []);
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

/**
 * Returns structured data optimized for product presentation layout, grouping variations by family ID.
 */
export async function getProductPresentation(productId) {
    try {
        checkPool();
        // 1. Get the target product and its family identifier (bling_parent_id)
        const query = 'SELECT id, name, bling_parent_id FROM products WHERE id = ? OR sku = ? LIMIT 1';
        const [rows] = await pool.query(query, [productId, productId]);
        if (!rows || rows.length === 0) {
            return errorResponse('PRODUCT_NOT_FOUND', 'Produto não localizado.');
        }

        const baseProduct = rows[0];
        const parentId = baseProduct.bling_parent_id || baseProduct.id;

        // 2. Fetch all variations belonging to the same product family
        const variationsQuery = `
            SELECT id, name, memory, price, colors, website_url 
            FROM products 
            WHERE (bling_parent_id = ? OR id = ? OR bling_parent_id = ?) AND active = 1 AND stock_quantity > 0
        `;
        const [variationsRows] = await pool.query(variationsQuery, [parentId, parentId, baseProduct.id]);
        
        const variations = (variationsRows || []).map(v => {
            const pricePix = Number(v.price);
            const priceCard = pricePix * 1.05; // 5% flat fee
            return {
                id: v.id,
                memory: v.memory || 'N/A',
                pricePix: pricePix,
                priceCard: priceCard,
                colors: v.colors ? v.colors.split(',').map(c => c.trim()) : [],
                link: v.website_url || 'https://www.mercadodovale.com.br'
            };
        });

        return successResponse({
            productId: baseProduct.id,
            model: baseProduct.name,
            variations
        });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}
