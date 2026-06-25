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

export async function getPaymentMethods() {
    return successResponse([
        { method: 'pix', label: 'PIX (Desconto de 5%)', enabled: true },
        { method: 'dinheiro', label: 'Dinheiro', enabled: true },
        { method: 'cartao', label: 'Cartão de Crédito', enabled: true },
        { method: 'misto', label: 'Pagamento Misto', enabled: true }
    ]);
}

export async function calculatePaymentOptions(orderIdOrData) {
    try {
        checkPool();
        let total = 0;
        let orderId = null;

        if (orderIdOrData && typeof orderIdOrData === 'object') {
            const productId = orderIdOrData.productId;
            const shippingFee = Number(orderIdOrData.shippingFee || 0);
            const quantity = Number(orderIdOrData.quantity || 1);

            if (!productId) {
                return errorResponse('PRODUCT_NOT_FOUND', 'Produto não especificado para simular pagamento.');
            }

            const query = 'SELECT price FROM products WHERE id = ? LIMIT 1';
            const [rows] = await pool.query(query, [productId]);
            if (!rows || rows.length === 0) {
                return errorResponse('PRODUCT_NOT_FOUND', 'Produto não localizado para simular pagamento.');
            }
            const productPrice = Number(rows[0].price);
            total = (productPrice * quantity) + shippingFee;
        } else {
            orderId = orderIdOrData;
            const query = 'SELECT total_amount FROM orders WHERE id = ? LIMIT 1';
            const [rows] = await pool.query(query, [orderId]);
            if (!rows || rows.length === 0) {
                return errorResponse('ORDER_NOT_FOUND', 'Pedido não localizado para simular pagamento.');
            }
            total = Number(rows[0].total_amount);
        }

        const pixDiscount = total * 0.95; // 5% discount

        const cardInstallments = [];
        // Calculate installments with credit card fee rules from ERP
        for (let i = 1; i <= 12; i++) {
            let amountPerMonth;
            if (i === 1) {
                amountPerMonth = total; // No fee for 1x card
            } else {
                // Apply credit card compound interest fee (e.g. 1.99% monthly or flat fee rate)
                const rate = 0.0199;
                const totalWithFee = total * (1 + (rate * i));
                amountPerMonth = totalWithFee / i;
            }
            cardInstallments.push({
                installment: i,
                amount_per_month: Number(amountPerMonth.toFixed(2)),
                total: Number((amountPerMonth * i).toFixed(2))
            });
        }

        return successResponse({
            order_id: orderId,
            base_amount: Number(total.toFixed(2)),
            pix_amount: Number(pixDiscount.toFixed(2)),
            card_options: cardInstallments
        });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

export async function simulateMixedPayment(orderIdOrData, downPayment) {
    try {
        checkPool();
        let total = 0;
        let orderId = null;
        let inputDownPayment = downPayment;

        if (orderIdOrData && typeof orderIdOrData === 'object') {
            const productId = orderIdOrData.productId;
            const shippingFee = Number(orderIdOrData.shippingFee || 0);
            const quantity = Number(orderIdOrData.quantity || 1);
            if (orderIdOrData.downPayment !== undefined) {
                inputDownPayment = orderIdOrData.downPayment;
            }

            if (!productId) {
                return errorResponse('PRODUCT_NOT_FOUND', 'Produto não especificado.');
            }

            const query = 'SELECT price FROM products WHERE id = ? LIMIT 1';
            const [rows] = await pool.query(query, [productId]);
            if (!rows || rows.length === 0) {
                return errorResponse('PRODUCT_NOT_FOUND', 'Produto não localizado.');
            }
            const productPrice = Number(rows[0].price);
            total = (productPrice * quantity) + shippingFee;
        } else {
            orderId = orderIdOrData;
            const query = 'SELECT total_amount FROM orders WHERE id = ? LIMIT 1';
            const [rows] = await pool.query(query, [orderId]);
            if (!rows || rows.length === 0) {
                return errorResponse('ORDER_NOT_FOUND', 'Pedido não localizado.');
            }
            total = Number(rows[0].total_amount);
        }

        const downPaymentValue = Number(inputDownPayment);

        if (downPaymentValue >= total) {
            return errorResponse('INVALID_DOWN_PAYMENT', 'O valor da entrada deve ser menor que o valor total do pedido.');
        }

        const balance = total - downPaymentValue;
        const cardInstallments = [];

        // Simulates credit card options on the balance
        for (let i = 1; i <= 6; i++) {
            const amountPerMonth = (balance * (1 + (0.015 * i))) / i;
            cardInstallments.push({
                installment: i,
                amount_per_month: Number(amountPerMonth.toFixed(2)),
                total: Number((amountPerMonth * i).toFixed(2))
            });
        }

        return successResponse({
            order_id: orderId,
            total_order: Number(total.toFixed(2)),
            down_payment: downPaymentValue,
            remaining_balance: Number(balance.toFixed(2)),
            card_balance_options: cardInstallments
        });
    } catch (err) {
        return errorResponse('ERP_UNAVAILABLE', err.message);
    }
}

