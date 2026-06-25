import assert from 'assert';
import { handle } from '../05-skills/EscolhaMemoriaSkill.js';
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

// Mock Database
const mockDb = {
    products: [
        { id: 101, name: 'Redmi Note 15', sku: 'REDMI-15-256', price: 1499.00, brand: 'Xiaomi', model: 'Note 15', memory: '256GB', stock_quantity: 10, active: 1, bling_parent_id: 1000 },
        { id: 102, name: 'Redmi Note 15', sku: 'REDMI-15-512', price: 1799.00, brand: 'Xiaomi', model: 'Note 15', memory: '512GB', stock_quantity: 5, active: 1, bling_parent_id: 1000 },
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
        conversation_id: 'test-uuid-777',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: { flow: SKILLS.ESCOLHA_MEMORIA, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
        },
        order_context: {
            cart: { product_id: 101, model: 'Redmi Note 15', selected_memory: null, selected_color: null, selected_case: null },
            delivery: { method: null, cep: null, address_details: null, shipping_fee: null },
            payment: { method: null, installments: null, amount: null }
        },
        customer_context: { name: null, cpf: null, phone: null, last_delivery_address: null, customer_tier: null }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da EscolhaMemoriaSkill.js...');
    ProductService.init(mockDb);

    // 1. Selection by index number ("2" maps to 512GB)
    {
        const context = createBaseContext();
        const res = await handle('2', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.selected_memory, '512GB');
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ESCOLHA_COR });
        console.log('✅ 1. Seleção por índice numérico passou.');
    }

    // 2. Selection by capacity string ("256")
    {
        const context = createBaseContext();
        const res = await handle('256', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.selected_memory, '256GB');
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ESCOLHA_COR });
        console.log('✅ 2. Seleção por termo textual (capacidade) passou.');
    }

    // 3. Selection by natural language ("pode ser o de 512gb")
    {
        const context = createBaseContext();
        const res = await handle('pode ser o de 512gb', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.selected_memory, '512GB');
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ESCOLHA_COR });
        console.log('✅ 3. Seleção por linguagem natural passou.');
    }

    // 4. Invalid Selection (choice not found)
    {
        const context = createBaseContext();
        const res = await handle('1024GB', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.routing, null);
        assert.ok(res.response.includes('Não encontrei essa opção de memória'));
        console.log('✅ 4. Tratamento de escolha inválida de memória passou.');
    }

    // 5. Product switch during memory flow ("Na verdade quero o POCO X8")
    {
        const context = createBaseContext();
        const res = await handle('Na verdade quero o POCO X8', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.product_id, 104); // Switched to Poco X8 ID
        assert.strictEqual(res.context.order_context.cart.selected_memory, null); // Cleared memory
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PRODUTO });
        console.log('✅ 5. Troca de produto durante seleção de memória passou.');
    }

    console.log('\n🎉 Todos os testes da EscolhaMemoriaSkill passaram!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes da EscolhaMemoriaSkill:', err);
    process.exit(1);
});
