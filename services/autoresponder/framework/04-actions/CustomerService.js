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

export async function getCustomer(sender) {
    try {
        checkPool();
        const query = 'SELECT id, name, cpf, phone, last_delivery_address, customer_tier FROM customers WHERE phone = ? LIMIT 1';
        const [rows] = await pool.query(query, [sender]);
        if (rows && rows.length > 0) {
            return successResponse(rows[0]);
        }
        return errorResponse('CUSTOMER_NOT_FOUND', 'Cliente não localizado.');
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function updateCustomer(sender, customerData = {}) {
    try {
        checkPool();
        const query = `
            INSERT INTO customers (phone, name, cpf, last_delivery_address, customer_tier)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            cpf = VALUES(cpf),
            last_delivery_address = VALUES(last_delivery_address),
            customer_tier = VALUES(customer_tier)
        `;
        const values = [
            sender,
            customerData.name,
            customerData.cpf,
            customerData.last_delivery_address,
            customerData.customer_tier || 'STANDARD'
        ];
        await pool.query(query, values);
        return successResponse({ phone: sender, updated: true });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function getOrCreateCustomer(sender) {
    try {
        const getRes = await getCustomer(sender);
        if (getRes.success) {
            return getRes;
        }

        // Create standard customer
        const defaultCustomer = {
            name: 'Cliente Novo',
            cpf: null,
            last_delivery_address: null,
            customer_tier: 'STANDARD'
        };

        const createRes = await updateCustomer(sender, defaultCustomer);
        if (createRes.success) {
            return successResponse({
                phone: sender,
                ...defaultCustomer
            });
        }
        return createRes;
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}
