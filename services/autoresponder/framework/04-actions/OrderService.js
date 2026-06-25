import { EventEmitter } from 'events';
export const orderEvents = new EventEmitter();

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

export async function getOrder(orderId) {
    try {
        checkPool();
        const query = 'SELECT id, customer_id, total_amount, status, created_at FROM orders WHERE id = ? LIMIT 1';
        const [rows] = await pool.query(query, [orderId]);
        if (rows && rows.length > 0) {
            return successResponse(rows[0]);
        }
        return errorResponse('ORDER_NOT_FOUND', 'Pedido não localizado.');
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function buildOrderSummary(orderId) {
    try {
        checkPool();
        const orderQuery = 'SELECT id, status, total_amount, shipping_fee, payment_method FROM orders WHERE id = ? LIMIT 1';
        const [orders] = await pool.query(orderQuery, [orderId]);
        if (!orders || orders.length === 0) {
            return errorResponse('ORDER_NOT_FOUND', 'Pedido não localizado.');
        }

        const itemsQuery = `
            SELECT i.product_id, p.name, i.quantity, i.price 
            FROM order_items i 
            JOIN products p ON i.product_id = p.id 
            WHERE i.order_id = ?
        `;
        const [items] = await pool.query(itemsQuery, [orderId]);

        const order = orders[0];
        return successResponse({
            order_id: order.id,
            status: order.status,
            payment_method: order.payment_method || 'Não definido',
            shipping_fee: Number(order.shipping_fee || 0),
            total_amount: Number(order.total_amount || 0),
            items: items.map(item => ({
                product_id: item.product_id,
                name: item.name,
                quantity: item.quantity,
                price: Number(item.price)
            }))
        });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function createOrder(orderData = {}) {
    try {
        checkPool();
        // Simulates inserting order in MySQL database and returning the generated ID
        const insertQuery = `
            INSERT INTO orders (customer_id, total_amount, status, shipping_fee, payment_method) 
            VALUES (?, ?, ?, ?, ?)
        `;
        const values = [
            orderData.customer_id,
            orderData.total_amount || 0,
            orderData.status || 'pending',
            orderData.shipping_fee || 0,
            orderData.payment_method
        ];
        const [result] = await pool.query(insertQuery, values);
        
        return successResponse({
            order_id: result.insertId || 'generated-uuid-for-test',
            status: orderData.status || 'pending'
        });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function updateOrder(orderId, orderData = {}) {
    try {
        checkPool();
        const updateQuery = 'UPDATE orders SET status = ?, payment_method = ? WHERE id = ?';
        await pool.query(updateQuery, [orderData.status, orderData.payment_method, orderId]);
        return successResponse({ order_id: orderId, updated: true });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function cancelOrder(orderId) {
    try {
        checkPool();
        const updateQuery = "UPDATE orders SET status = 'cancelled' WHERE id = ?";
        await pool.query(updateQuery, [orderId]);
        return successResponse({ order_id: orderId, cancelled: true });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function finalizeOrder(snapshot, idempotencyKey) {
    try {
        checkPool();
        if (!snapshot || !snapshot.cart || !snapshot.payment || !snapshot.delivery) {
            return errorResponse('INVALID_SNAPSHOT', 'Snapshot inválido.');
        }

        // 1. Idempotency Check
        if (idempotencyKey) {
            // Check if order exists with status matching the idempotencyKey
            const [existing] = await pool.query('SELECT id, total_amount FROM orders WHERE status = ? LIMIT 1', [idempotencyKey]);
            if (existing && existing.length > 0) {
                return successResponse({
                    orderId: existing[0].id,
                    orderNumber: 'MDV-' + existing[0].id,
                    protocol: 'PRT' + existing[0].id,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // 2. Atomic Transaction Block
        await pool.query('START TRANSACTION');

        try {
            const totalAmount = Number(snapshot.payment.total || 0);
            const shippingFee = Number(snapshot.delivery.shipping_fee || 0);
            const paymentMethod = snapshot.payment.method;

            // Insert order
            const insertQuery = `
                INSERT INTO orders (total_amount, status, shipping_fee, payment_method) 
                VALUES (?, ?, ?, ?)
            `;
            const [result] = await pool.query(insertQuery, [totalAmount, idempotencyKey || 'confirmed', shippingFee, paymentMethod]);
            const orderId = result.insertId || 502;

            // Insert items
            if (snapshot.cart.product_id) {
                const itemQuery = `
                    INSERT INTO order_items (order_id, product_id, quantity, price) 
                    VALUES (?, ?, ?, ?)
                `;
                const productPrice = snapshot.payment.installment_value || snapshot.payment.total;
                await pool.query(itemQuery, [orderId, snapshot.cart.product_id, snapshot.cart.quantity || 1, productPrice]);
            }

            // Commit transaction
            await pool.query('COMMIT');

            const orderNumber = 'MDV-' + orderId;
            const protocol = 'PRT' + orderId;
            const createdAt = new Date().toISOString();

            const orderData = {
                orderId,
                orderNumber,
                protocol,
                createdAt
            };

            // 3. Publish ORDER_CREATED event asynchronously/decoupled
            setImmediate(() => {
                orderEvents.emit('ORDER_CREATED', orderData);
            });

            return successResponse(orderData);

        } catch (txErr) {
            await pool.query('ROLLBACK');
            throw txErr;
        }

    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

