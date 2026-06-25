import assert from 'assert';
import { handle } from '../05-skills/EscolhaCorSkill.js';
import * as ProductService from '../04-actions/ProductService.js';
import * as PromotionService from '../04-actions/PromotionService.js';
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

// Mock Database for test scenarios
const mockDb = {
    products: [
        { id: 101, name: 'Redmi Note 15', sku: 'REDMI-15-256', price: 1499.00, brand: 'Xiaomi', model: 'Note 15', memory: '256GB', stock_quantity: 10, active: 1, bling_parent_id: 1000, colors: 'Black, Blue' },
        { id: 102, name: 'Redmi Note 15', sku: 'REDMI-15-512', price: 1799.00, brand: 'Xiaomi', model: 'Note 15', memory: '512GB', stock_quantity: 5, active: 1, bling_parent_id: 1000, colors: 'Blue, Green' },
        { id: 103, name: 'Galaxy A35', sku: 'GALAXY-35-128', price: 1799.00, brand: 'Samsung', model: 'A35', memory: '128GB', stock_quantity: 12, active: 1, bling_parent_id: 2000, colors: 'Silver' },
        { id: 104, name: 'POCO X8', sku: 'POCO-X8-256', price: 2199.00, brand: 'Xiaomi', model: 'POCO X8', memory: '256GB', stock_quantity: 3, active: 1, bling_parent_id: 3000, colors: 'Black' },
        
        // Accessories
        { id: 201, name: 'Capinha Silicone Preta', price: 0 },
        { id: 202, name: 'Capinha Silicone Azul', price: 0 }
    ],
    query: async function(sql, values = []) {
        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ');

        // SELECT single model details
        if (cleanSql.includes('SELECT ID, NAME, BLING_PARENT_ID FROM PRODUCTS')) {
            const id = values[0];
            const prod = this.products.find(p => p.id === Number(id) || p.sku === id);
            return prod ? [[prod]] : [[]];
        }

        // SELECT active variations
        if (cleanSql.includes('SELECT ID, NAME, MEMORY, PRICE, COLORS')) {
            const parentId = values[0];
            const baseId = values[1];
            const list = this.products.filter(p => p.bling_parent_id === parentId || p.id === baseId || p.id === parentId);
            return [list];
        }

        // SELECT compatible accessories
        if (cleanSql.includes('SELECT P.ID, P.NAME, P.PRICE')) {
            const productId = values[0];
            // Returns accessories depending on compatibility filter simulation
            if (productId === 101) {
                return [[
                    this.products.find(p => p.id === 201),
                    this.products.find(p => p.id === 202)
                ]];
            }
            return [[]];
        }

        // findProducts search fallback
        if (cleanSql.includes('WHERE ACTIVE = 1')) {
            const modelName = values[0].toLowerCase();
            const matched = this.products.filter(p => {
                const pModel = (p.model || '').toLowerCase();
                const pName = (p.name || '').toLowerCase();
                return pModel && (modelName.includes(pModel) || modelName.includes(pName) || pModel.includes(modelName) || pName.includes(modelName));
            });
            return [matched];
        }

        // SELECT price for promotion calculation without order_id
        if (cleanSql.includes('SELECT PRICE FROM PRODUCTS')) {
            const productId = values[0];
            const prod = this.products.find(p => p.id === Number(productId));
            return prod ? [[prod]] : [[]];
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
            state: { flow: SKILLS.ESCOLHA_COR, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
        },
        order_context: {
            cart: { product_id: 101, model: 'Redmi Note 15', selected_memory: '256GB', selected_color: null },
            delivery: { method: null, cep: null, address_details: null, shipping_fee: null },
            payment: { method: null, installments: null, amount: null }
        },
        customer_context: { name: 'Gustavo', cpf: null, phone: '5587999999999', last_delivery_address: null, customer_tier: 'Regular' }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da EscolhaCorSkill.js...');
    ProductService.init(mockDb);
    PromotionService.init(mockDb);

    // Scenario 1: Present colors on INIT
    {
        const context = createBaseContext();
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Cores disponíveis'));
        assert.ok(res.response.includes('1. Black'));
        assert.ok(res.response.includes('2. Blue'));
        assert.strictEqual(res.context.conversation_context.state.step, STATES.AWAITING_INPUT);
        assert.strictEqual(res.context.conversation_context.state.waiting_for, WAITING_FOR.COLOR_SELECTION);
        console.log('✅ 1. Apresentação de opções de cores no INIT passou.');
    }

    // Scenario 2: Select color by Index (Number)
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = WAITING_FOR.COLOR_SELECTION;
        context.conversation_context.routing.last_active_list = ['Black', 'Blue'];

        const res = await handle('2', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.selected_color, 'Blue');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'case_selection');
        assert.ok(res.response.includes('Capinha Premium de Brinde'));
        assert.ok(res.response.includes('Película 3D de Brinde'));
        console.log('✅ 2. Seleção de cor por número (índice da lista) passou.');
    }

    // Scenario 3: Select color by text capacity (Linguagem Natural)
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = WAITING_FOR.COLOR_SELECTION;
        context.conversation_context.routing.last_active_list = ['Black', 'Blue'];

        const res = await handle('quero a cor preta por favor', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.selected_color, 'Black');
        console.log('✅ 3. Seleção de cor por texto em linguagem natural passou.');
    }

    // Scenario 4: Invalid color entry
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = WAITING_FOR.COLOR_SELECTION;
        context.conversation_context.routing.last_active_list = ['Black', 'Blue'];

        const res = await handle('rosa choque', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Não consegui identificar essa cor'));
        assert.strictEqual(res.context.order_context.cart.selected_color, null);
        console.log('✅ 4. Tratamento de cor inexistente passou.');
    }

    // Scenario 5: Dynamic product switch
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = WAITING_FOR.COLOR_SELECTION;

        const res = await handle('Na verdade quero o POCO X8', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.product_id, 104);
        assert.strictEqual(res.context.order_context.cart.selected_memory, null);
        assert.strictEqual(res.context.order_context.cart.selected_color, null);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PRODUTO });
        console.log('✅ 5. Troca dinâmica de produto no meio do fluxo passou.');
    }

    // Scenario 6: Product with screen protector only (Under 1000 - Galaxy A35 is 1799 but price mock for A35 can test 500 eligibility)
    // We change the price manually or set a product ID that maps to under 1000 in DB.
    // Galaxy A35 price is 1799. Let's create mock scenario with product ID 103 (price 1799 = eligible for case & screen).
    // Let's verify benefits calculated dynamically without order_id (from productId price).
    {
        const context = createBaseContext();
        context.order_context.cart.product_id = 103; // A35 (1799)
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = WAITING_FOR.COLOR_SELECTION;
        context.conversation_context.routing.last_active_list = ['Silver'];

        const res = await handle('silver', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.context.order_context.benefits['gift-screen'].eligible);
        assert.ok(res.context.order_context.benefits['gift-case'].eligible);
        console.log('✅ 6. Benefícios calculados dinamicamente sem dependência de order_id passou.');
    }

    // Scenario 7: Postponing case selection
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'case_selection';
        context.order_context.cart.selected_color = 'Blue';
        context.order_context.benefits = {
            'gift-case': { eligible: true, accepted: null, pending: true, accessory_id: null, color: null }
        };

        const res = await handle('vou ver depois', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].accepted, true);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].pending, true);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].accessory_id, null);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ENTREGA });
        console.log('✅ 7. Opção de adiar escolha da capinha (selected_case_pending) passou.');
    }

    // Scenario 8: Refusing case selection
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'case_selection';
        context.order_context.cart.selected_color = 'Blue';
        context.order_context.benefits = {
            'gift-case': { eligible: true, accepted: null, pending: true, accessory_id: null, color: null }
        };

        const res = await handle('não quero capinha', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].accepted, false);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].pending, false);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ENTREGA });
        console.log('✅ 8. Opção de recusar capinha passou.');
    }

    // Scenario 9: Choosing capinha successfully
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'case_selection';
        context.order_context.cart.selected_color = 'Blue';
        context.order_context.benefits = {
            'gift-case': { eligible: true, accepted: null, pending: true, accessory_id: null, color: null }
        };

        const res = await handle('Capinha Silicone Preta', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].accepted, true);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].pending, false);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].accessory_id, 201);
        assert.strictEqual(res.context.order_context.benefits['gift-case'].color, 'Preta');
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ENTREGA });
        console.log('✅ 9. Escolha de capinha com sucesso e gravação correta no contexto passou.');
    }

    console.log('\n🎉 Todos os testes da EscolhaCorSkill passaram com sucesso!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes de EscolhaCorSkill:', err);
    process.exit(1);
});
