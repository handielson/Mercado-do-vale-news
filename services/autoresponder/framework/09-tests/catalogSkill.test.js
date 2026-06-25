import assert from 'assert';
import { handle } from '../05-skills/CatalogSkill.js';
import * as ProductService from '../04-actions/ProductService.js';
import { SKILLS, STATES, WAITING_FOR } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import GeneralPolicy from '../03-policies/GeneralPolicy.js';
import ConversationPolicy from '../03-policies/ConversationPolicy.js';
import ValidationPolicy from '../03-policies/ValidationPolicy.js';

// Setup policies
PolicyEngine.clear();
PolicyEngine.register(GeneralPolicy);
PolicyEngine.register(ConversationPolicy);
PolicyEngine.register(ValidationPolicy);

// Mock Database with products
const mockDb = {
    products: [
        { id: 101, name: 'Redmi Note 15', sku: 'REDMI-15', price: 1499.00, brand: 'Xiaomi', model: 'Note 15', memory: '256GB', stock_quantity: 10, active: 1 },
        { id: 102, name: 'POCO X8 Pro', sku: 'POCO-X8', price: 2499.00, brand: 'Xiaomi', model: 'X8 Pro', memory: '512GB', stock_quantity: 5, active: 1 },
        { id: 103, name: 'Galaxy S25', sku: 'GALAXY-25', price: 4999.00, brand: 'Samsung', model: 'S25', memory: '256GB', stock_quantity: 8, active: 1 },
        { id: 104, name: 'Galaxy A35', sku: 'GALAXY-35', price: 1799.00, brand: 'Samsung', model: 'A35', memory: '128GB', stock_quantity: 12, active: 1 },
        { id: 105, name: 'realme C75', sku: 'REALME-C75', price: 999.00, brand: 'Realme', model: 'C75', memory: '128GB', stock_quantity: 15, active: 1 }
    ],
    query: async function(sql, values = []) {
        const cleanSql = sql.toUpperCase();
        
        // SELECT ALL active catalog
        if (cleanSql.includes('STOCK_QUANTITY > 0 AND ACTIVE = 1')) {
            return [this.products];
        }

        // SELECT filtered products
        if (cleanSql.includes('WHERE ACTIVE = 1')) {
            let filtered = [...this.products];
            
            // Simulates brand filter
            if (cleanSql.includes('BRAND = ?')) {
                const brandVal = values[0];
                filtered = filtered.filter(p => p.brand.toLowerCase() === brandVal.toLowerCase());
            }
            // Simulates model filter
            if (cleanSql.includes('MODEL = ?')) {
                const modelVal = values[0];
                filtered = filtered.filter(p => p.model.toLowerCase() === modelVal.toLowerCase() || p.name.toLowerCase().includes(modelVal.toLowerCase()));
            }
            // Simulates memory filter
            if (cleanSql.includes('MEMORY = ?')) {
                const memoryVal = values[values.length - 1]; // pick last matching parameters
                filtered = filtered.filter(p => p.memory === memoryVal);
            }
            // Simulates price filters
            if (cleanSql.includes('PRICE <= ?')) {
                const maxPrice = values[values.length - 1];
                filtered = filtered.filter(p => p.price <= maxPrice);
            }
            return [filtered];
        }
        return [[]];
    }
};

function createBaseContext() {
    return {
        conversation_id: 'test-uuid-999',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: {
                flow: SKILLS.CATALOGO,
                step: STATES.INIT,
                waiting_for: WAITING_FOR.NONE,
                expires_at: null
            },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending', last_active_list: [] }
        },
        order_context: {
            cart: { product_id: null, model_name: null, quantity: null, color: null, memory: null },
            delivery: { method: null, cep: null, address_details: null, shipping_fee: null },
            payment: { method: null, installments: null, amount: null }
        },
        customer_context: { name: null, cpf: null, phone: null, last_delivery_address: null, customer_tier: null }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da CatalogSkill.js...');
    ProductService.init(mockDb);

    // Test 1: Full catalog presentation (aggrouped, ordered, continuous numbers)
    {
        const context = createBaseContext();
        const res = await handle('Me mostra os celulares', context);

        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('*Realme*'));
        assert.ok(res.response.includes('*Samsung*'));
        assert.ok(res.response.includes('*Xiaomi*'));
        // Verifies continuous numbering
        assert.ok(res.response.includes('1. realme C75'));
        assert.ok(res.response.includes('2. Galaxy A35'));
        assert.ok(res.response.includes('3. Galaxy S25'));
        assert.ok(res.response.includes('4. POCO X8 Pro'));
        assert.ok(res.response.includes('5. Redmi Note 15'));
        assert.ok(res.response.includes('Qual modelo você gostaria de conhecer melhor?'));
        // Verifies active list ids mapping saved in context
        assert.deepStrictEqual(res.context.conversation_context.routing.last_active_list, [105, 104, 103, 102, 101]);
        console.log('✅ 1. Apresentação do Catálogo Completo (agrupado, ordenado e numerado) passou.');
    }

    // Test 2: Catalog filtered by Brand ("Samsung")
    {
        const context = createBaseContext();
        const res = await handle('Quero ver os da Samsung', context);

        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('*Samsung*'));
        assert.ok(!res.response.includes('*Xiaomi*')); // Should filter out Xiaomi
        assert.ok(res.response.includes('Deseja ver a lista completa de aparelhos disponíveis?'));
        console.log('✅ 2. Filtragem de catálogo por marca passou.');
    }

    // Test 3: Selection by Number (continuous index mapped to real product_id)
    {
        const context = createBaseContext();
        // Setup mock previous search result in the active list context
        context.conversation_context.routing.last_active_list = [105, 104, 103, 102, 101];

        // Client chooses "2" (maps to 104 -> Galaxy A35)
        const res = await handle('2', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.product_id, 104);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PRODUTO });
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.PRODUTO);
        console.log('✅ 3. Seleção por índice numérico de lista ativa passou.');
    }

    // Test 4: Selection by model name search
    {
        const context = createBaseContext();
        const res = await handle('Redmi Note 15', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.product_id, 101);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PRODUTO });
        console.log('✅ 4. Seleção por nome exato do modelo passou.');
    }

    console.log('\n🎉 Todos os testes da CatalogSkill passaram!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes da CatalogSkill:', err);
    process.exit(1);
});
