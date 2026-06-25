import assert from 'assert';
import * as ProductService from '../04-actions/ProductService.js';
import * as OrderService from '../04-actions/OrderService.js';
import * as DeliveryService from '../04-actions/DeliveryService.js';
import * as PaymentService from '../04-actions/PaymentService.js';
import * as StoreService from '../04-actions/StoreService.js';
import * as CustomerService from '../04-actions/CustomerService.js';
import * as PromotionService from '../04-actions/PromotionService.js';

// Mock Database Pool
const mockDb = {
    shouldTimeout: false,
    shouldFail: false,
    records: {
        products: [
            { id: 101, name: 'Redmi Note 15', sku: 'REDMI-15', price: 1499.00, stock_quantity: 10, colors: 'Black, Blue', website_url: 'https://site.com/redmi-15', active: 1, brand: 'Xiaomi', model: 'Note 15', memory: '256GB' }
        ],
        orders: [
            { id: 501, customer_id: '99', total_amount: 1500.00, status: 'pending', shipping_fee: 15.00, payment_method: 'pix' }
        ],
        order_items: [
            { product_id: 101, order_id: 501, quantity: 1, price: 1499.00, name: 'Redmi Note 15' }
        ],
        customers: [
            { id: 99, phone: '5587999999999', name: 'João da Silva', cpf: '123.456.789-00', last_delivery_address: 'Rua Principal, 123', customer_tier: 'VIP' }
        ]
    },
    query: async function(sql, values = []) {
        if (this.shouldTimeout) {
            throw new Error('ETIMEDOUT: Connection pool timeout exceeded');
        }
        if (this.shouldFail) {
            throw new Error('ER_CON_COUNT_ERROR: Too many connections');
        }

        const normalizedSql = sql.trim().toUpperCase().replace(/\s+/g, ' ');

        // SELECT orders
        if (normalizedSql.includes('FROM ORDERS')) {
            const id = values[0];
            const order = this.records.orders.find(o => o.id === Number(id));
            return order ? [[order]] : [[]];
        }

        // SELECT items
        if (normalizedSql.includes('FROM ORDER_ITEMS I')) {
            const orderId = values[0];
            const items = this.records.order_items.filter(i => i.order_id === Number(orderId));
            return [items];
        }

        // SELECT single product name/parent info
        if (normalizedSql.includes('SELECT ID, NAME, BLING_PARENT_ID FROM PRODUCTS')) {
            const idOrSku = values[0];
            const prod = this.records.products.find(p => p.id === Number(idOrSku) || p.sku === idOrSku);
            return prod ? [[prod]] : [[]];
        }

        // SELECT active variations
        if (normalizedSql.includes('BLING_PARENT_ID = ? OR ID = ?')) {
            const parentId = values[0];
            const baseId = values[1];
            const list = this.records.products.filter(p => p.bling_parent_id === parentId || p.id === baseId || p.id === parentId);
            return [list];
        }

        // SELECT customers
        if (normalizedSql.includes('FROM CUSTOMERS')) {
            const phone = values[0];
            const cust = this.records.customers.find(c => c.phone === phone);
            return cust ? [[cust]] : [[]];
        }

        // INSERT INTO orders
        if (normalizedSql.startsWith('INSERT INTO ORDERS')) {
            return [{ insertId: 502 }];
        }

        // UPDATE orders or INSERT customers
        if (normalizedSql.startsWith('UPDATE ORDERS') || normalizedSql.startsWith('INSERT INTO CUSTOMERS')) {
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }
};

async function testSuite() {
    console.log('🧪 Iniciando testes das Actions (Módulo 04)...');

    // Initialize all services
    ProductService.init(mockDb);
    OrderService.init(mockDb);
    DeliveryService.init(mockDb);
    PaymentService.init(mockDb);
    StoreService.init(mockDb);
    CustomerService.init(mockDb);
    PromotionService.init(mockDb);

    // 1. Test ProductService SUCCESS
    {
        const res = await ProductService.getProductPresentation(101);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.data.model, 'Redmi Note 15');
        assert.strictEqual(res.data.variations[0].pricePix, 1499.00);
        assert.strictEqual(res.data.variations[0].priceCard, 1499.00 * 1.05);
        console.log('✅ 1. ProductService.getProductPresentation - Sucesso.');
    }

    // 2. Test ProductService ERROR (Not Found)
    {
        const res = await ProductService.getProductPresentation(999);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.error.code, 'PRODUCT_NOT_FOUND');
        console.log('✅ 2. ProductService - Produto não localizado.');
    }

    // 3. Test OrderService buildOrderSummary
    {
        const res = await OrderService.buildOrderSummary(501);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.data.total_amount, 1500.00);
        assert.strictEqual(res.data.items[0].name, 'Redmi Note 15');
        console.log('✅ 3. OrderService.buildOrderSummary - Sucesso.');
    }

    // 4. Test PaymentService calculations
    {
        const res = await PaymentService.calculatePaymentOptions(501);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.data.pix_amount, 1500.00 * 0.95);
        assert.strictEqual(res.data.card_options.length, 12);
        console.log('✅ 4. PaymentService.calculatePaymentOptions - Sucesso.');
    }

    // 5. Test CustomerService getOrCreateCustomer
    {
        const res = await CustomerService.getOrCreateCustomer('5587999999999');
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.data.name, 'João da Silva');

        // Test non-existing customer triggers auto-creation
        const newCustRes = await CustomerService.getOrCreateCustomer('5587988888888');
        assert.strictEqual(newCustRes.success, true);
        assert.strictEqual(newCustRes.data.name, 'Cliente Novo');
        console.log('✅ 5. CustomerService.getOrCreateCustomer - Sucesso.');
    }

    // 6. Test StoreService isOpen
    {
        const res = await StoreService.isStoreOpen();
        assert.strictEqual(res.success, true);
        assert.ok(res.data.status === 'aberta' || res.data.status === 'fechada');
        console.log('✅ 6. StoreService.isStoreOpen - Sucesso.');
    }

    // 7. Test Contingency - ERP Offline / Failure handling
    {
        mockDb.shouldFail = true;
        const res = await ProductService.getProduct(101);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.error.code, 'ERP_UNAVAILABLE');
        
        mockDb.shouldFail = false;
        console.log('✅ 7. Contingenciamento de indisponibilidade do ERP passou.');
    }

    // 8. Test Contingency - Connection pool Timeout
    {
        mockDb.shouldTimeout = true;
        const res = await OrderService.getOrder(501);
        assert.strictEqual(res.success, false);
        assert.strictEqual(res.error.code, 'ERP_UNAVAILABLE');
        assert.ok(res.error.message.includes('ETIMEDOUT'));
        
        mockDb.shouldTimeout = false;
        console.log('✅ 8. Contingenciamento de timeout de banco de dados passou.');
    }

    console.log('\n🎉 Todos os testes de Actions foram aprovados com sucesso!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes de Actions:', err);
    process.exit(1);
});
