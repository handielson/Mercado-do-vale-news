import assert from 'assert';
import { handle } from '../05-skills/ProductSkill.js';
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

// Mock Database representing product family parent relationships
const mockDb = {
    products: [
        { id: 101, name: 'Redmi Note 15', sku: 'REDMI-15-256', price: 1499.00, brand: 'Xiaomi', model: 'Note 15', memory: '256GB', stock_quantity: 10, active: 1, bling_parent_id: 1000 },
        { id: 102, name: 'Redmi Note 15', sku: 'REDMI-15-512', price: 1799.00, brand: 'Xiaomi', model: 'Note 15', memory: '512GB', stock_quantity: 5, active: 1, bling_parent_id: 1000 },
        { id: 103, name: 'Galaxy A35', sku: 'GALAXY-35-128', price: 1799.00, brand: 'Samsung', model: 'A35', memory: '128GB', stock_quantity: 12, active: 1, bling_parent_id: 2000 },
        { id: 104, name: 'POCO X8', sku: 'POCO-X8-256', price: 2199.00, brand: 'Xiaomi', model: 'POCO X8', memory: '256GB', stock_quantity: 3, active: 1, bling_parent_id: 3000 }
    ],
    query: async function(sql, values = []) {
        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ');

        // SELECT single model details
        if (cleanSql.includes('SELECT ID, NAME, BLING_PARENT_ID FROM PRODUCTS')) {
            const id = values[0];
            const prod = this.products.find(p => p.id === Number(id) || p.sku === id);
            return prod ? [[prod]] : [[]];
        }

        // SELECT active variations by family ID
        if (cleanSql.includes('SELECT ID, NAME, MEMORY, PRICE, COLORS')) {
            const parentId = values[0];
            const baseId = values[1];
            const list = this.products.filter(p => p.bling_parent_id === parentId || p.id === baseId || p.id === parentId);
            return [list];
        }

        // findProducts search fallback
        if (cleanSql.includes('WHERE ACTIVE = 1')) {
            const modelName = values[0].toLowerCase();
            const matched = this.products.filter(p => {
                const pModel = p.model.toLowerCase();
                const pName = p.name.toLowerCase();
                return modelName.includes(pModel) || modelName.includes(pName) || pModel.includes(modelName) || pName.includes(modelName);
            });
            return [matched];
        }

        return [[]];
    }
};

function createBaseContext() {
    return {
        conversation_id: 'test-uuid-888',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: { flow: SKILLS.PRODUTO, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
        },
        order_context: {
            cart: { product_id: null, model: null, selected_memory: null, selected_color: null, selected_case: null },
            delivery: { method: null, cep: null, address_details: null, shipping_fee: null },
            payment: { method: null, installments: null, amount: null }
        },
        customer_context: { name: null, cpf: null, phone: null, last_delivery_address: null, customer_tier: null }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da ProductSkill.js...');
    ProductService.init(mockDb);

    // Scenario 1: Product with a single memory variation (Galaxy A35 has only 128GB)
    {
        const context = createBaseContext();
        context.order_context.cart.product_id = 103; // Galaxy A35

        const res = await handle('quero ver detalhes', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Galaxy A35'));
        assert.ok(res.response.includes('📱 128GB'));
        assert.ok(res.response.includes('🎁 Na compra deste smartphone')); // gifts presence
        assert.strictEqual(res.context.order_context.cart.selected_memory, '128GB'); // auto-selected
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ESCOLHA_COR });
        console.log('✅ 1. Produto com única memória e seleção automática passou.');
    }

    // Scenario 2: Product with multiple variations (Redmi Note 15 has 256GB and 512GB)
    {
        const context = createBaseContext();
        context.order_context.cart.product_id = 101; // Redmi Note 15

        const res = await handle('quero detalhes dele', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('📱 256GB'));
        assert.ok(res.response.includes('📱 512GB'));
        assert.ok(res.response.includes('Qual versão de memória você prefere?'));
        assert.strictEqual(res.context.order_context.cart.selected_memory, null); // not selected yet
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ESCOLHA_MEMORIA });
        console.log('✅ 2. Produto com múltiplas memórias e roteamento correto passou.');
    }

    // Scenario 3: Memory pre-informed in the message (Redmi Note 15 with 512GB choice)
    {
        const context = createBaseContext();
        context.order_context.cart.product_id = 101;

        const res = await handle('Quero o de 512GB', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.selected_memory, '512GB');
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ESCOLHA_COR });
        console.log('✅ 3. Detecção e validação de memória pré-informada passou.');
    }

    // Scenario 4: Switching model during ProductSkill
    {
        const context = createBaseContext();
        context.order_context.cart.product_id = 101; // started with Redmi
        context.order_context.cart.selected_memory = '256GB'; // mock previous state

        // Client changes choice directly
        const res = await handle('Na verdade quero o POCO X8', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.product_id, 104); // switched to Poco X8 ID
        assert.strictEqual(res.context.order_context.cart.selected_memory, '256GB'); // Auto-selected single memory of Poco X8
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ESCOLHA_COR });
        console.log('✅ 4. Alteração de produto durante o fluxo de apresentação passou.');
    }

    console.log('\n🎉 Todos os testes da ProductSkill passaram!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes da ProductSkill:', err);
    process.exit(1);
});
