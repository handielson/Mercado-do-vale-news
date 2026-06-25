let pool = null;

export function init(mysqlPool) {
    pool = mysqlPool;
}

function errorResponse(code, message) {
    return { success: false, error: { code, message } };
}

function successResponse(data) {
    return { success: true, data };
}

function checkPool() {
    if (!pool) throw new Error('DATABASE_POOL_NOT_INITIALIZED');
}

export async function getCurrentPromotions() {
    try {
        checkPool();
        const query = 'SELECT id, title, description, discount_pct FROM promotions WHERE active = 1';
        const [rows] = await pool.query(query);
        return successResponse(rows || []);
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function getEligibleBenefits(param) {
    try {
        checkPool();
        let total = 0;

        if (param && typeof param === 'object') {
            // New signature: { productId, memory, color, customer, cart }
            const productId = param.productId;
            if (productId) {
                const query = 'SELECT price FROM products WHERE id = ? LIMIT 1';
                const [rows] = await pool.query(query, [productId]);
                if (rows && rows.length > 0) {
                    total = Number(rows[0].price);
                }
            }
        } else if (param) {
            // Legacy signature: orderId
            const orderQuery = 'SELECT total_amount FROM orders WHERE id = ? LIMIT 1';
            const [orders] = await pool.query(orderQuery, [param]);
            if (orders && orders.length > 0) {
                total = Number(orders[0].total_amount);
            }
        }

        const benefits = [];

        // ERP rules for free gifts based on price/total
        if (total >= 1000) {
            benefits.push({ id: 'gift-screen', type: 'screen_protector', name: 'Película 3D de Brinde', requiresSelection: false });
            benefits.push({ id: 'gift-case', type: 'case', name: 'Capinha Premium de Brinde', requiresSelection: true });
        } else if (total >= 500) {
            benefits.push({ id: 'gift-screen', type: 'screen_protector', name: 'Película 3D de Brinde', requiresSelection: false });
        }

        return successResponse(benefits);
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}
