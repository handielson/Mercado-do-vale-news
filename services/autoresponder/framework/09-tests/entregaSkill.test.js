import assert from 'assert';
import { handle } from '../05-skills/EntregaSkill.js';
import * as DeliveryService from '../04-actions/DeliveryService.js';
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
        { id: 104, name: 'POCO X8', sku: 'POCO-X8-256', price: 2199.00, brand: 'Xiaomi', model: 'POCO X8', memory: '256GB', stock_quantity: 3, active: 1, bling_parent_id: 3000 }
    ],
    shipping_rules: [
        { start_cep: '56320000', end_cep: '56320999', fee: 20.00, estimated_days: 3 }
    ],
    cep_cache: [
        { cep: '56320690', street: 'Rua João Pessoa', neighborhood: 'Centro', city: 'Petrolina', state: 'PE' }
    ],
    query: async function(sql, values = []) {
        if (this.shouldTimeout) {
            throw new Error('ETIMEDOUT: Connection pool timeout exceeded');
        }
        if (this.shouldFail) {
            throw new Error('ER_CON_COUNT_ERROR: Too many connections');
        }

        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ');

        // SELECT single model details
        if (cleanSql.includes('SELECT ID, NAME, BLING_PARENT_ID FROM PRODUCTS')) {
            const id = values[0];
            const prod = this.products.find(p => p.id === Number(id) || p.sku === id);
            return prod ? [[prod]] : [[]];
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

        // calculateFreight SELECT shipping_rules
        if (cleanSql.includes('SELECT FEE, ESTIMATED_DAYS FROM SHIPPING_RULES')) {
            const cep = values[0];
            const rule = this.shipping_rules.find(r => cep >= r.start_cep && cep <= r.end_cep);
            return rule ? [[rule]] : [[]];
        }

        // resolveAddress SELECT cep_cache
        if (cleanSql.includes('SELECT STREET, NEIGHBORHOOD, CITY, STATE FROM CEP_CACHE')) {
            const cep = values[0];
            const cache = this.cep_cache.find(c => c.cep === cep);
            return cache ? [[cache]] : [[]];
        }

        return [[]];
    }
};

function createBaseContext() {
    return {
        conversation_id: 'test-delivery-777',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: { flow: SKILLS.ENTREGA, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
        },
        order_context: {
            cart: { product_id: 101, model: 'Redmi Note 15', selected_memory: '256GB', selected_color: 'Blue' },
            delivery: {},
            payment: {}
        },
        customer_context: { name: 'João', cpf: null, phone: '5587999999999', last_delivery_address: null, customer_tier: 'Regular' }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da EntregaSkill.js...');
    DeliveryService.init(mockDb);
    ProductService.init(mockDb);

    // Scenario 1: Select Pickup (Retirada) by natural language
    {
        const context = createBaseContext();
        const res = await handle('vou retirar pessoalmente', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.method, 'pickup');
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.PAGAMENTO);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PAGAMENTO });
        console.log('✅ 1. Seleção de retirada pessoal (pickup) via linguagem natural passou.');
    }

    // Scenario 2: Select Delivery (Entrega) by natural language
    {
        const context = createBaseContext();
        const res = await handle('entrega em casa', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.method, 'delivery');
        // Because it falls through to missing fields: it will ask for CEP
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'address_input');
        assert.ok(res.response.includes('informe o CEP'));
        console.log('✅ 2. Seleção de entrega (delivery) via linguagem natural passou.');
    }

    // Scenario 3: Complete address in a single message
    {
        const context = createBaseContext();
        context.order_context.delivery.method = 'delivery';
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'address_input';

        const res = await handle('Rua João Pessoa, 125, apartamento 302, CEP 56320-690', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.raw_cep, '56320690');
        assert.strictEqual(res.context.order_context.delivery.number, '125');
        assert.strictEqual(res.context.order_context.delivery.complement, 'apartamento 302');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'address_confirmation');
        assert.ok(res.response.includes('Endereço de entrega'));
        console.log('✅ 3. Endereço completo em mensagem única processado com sucesso.');
    }

    // Scenario 4: Address in multiple messages (CEP first, then number, then complement)
    {
        const context = createBaseContext();
        context.order_context.delivery.method = 'delivery';
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'address_input';

        // 1. Send CEP
        let res = await handle('CEP 56320-690', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.raw_cep, '56320690');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'number_input');
        assert.ok(res.response.includes('número'));

        // 2. Send Number
        res = await handle('125', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.number, '125');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'complement_input');
        assert.ok(res.response.includes('complemento'));

        // 3. Send Complement
        res = await handle('apto 302', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.complement, 'apto 302');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'address_confirmation');
        console.log('✅ 4. Endereço segmentado em múltiplas mensagens passou.');
    }

    // Scenario 5: Location sharing (coordinates object)
    {
        const context = createBaseContext();
        context.order_context.delivery.method = 'delivery';
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'address_input';

        const locationShared = { latitude: -9.3812, longitude: -40.5014 };
        const res = await handle(locationShared, context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.address.street, 'Localização compartilhada');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'number_input');
        console.log('✅ 5. Localização compartilhada (coordenadas) processada com sucesso.');
    }

    // Scenario 6: Customer declines complement
    {
        const context = createBaseContext();
        context.order_context.delivery.method = 'delivery';
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'complement_input';
        context.order_context.delivery.address = { cep: '56320690', street: 'Rua João Pessoa', district: 'Centro', city: 'Petrolina', state: 'PE' };
        context.order_context.delivery.number = '125';

        const res = await handle('não tenho', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.complement, 'Não possui');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'address_confirmation');
        console.log('✅ 6. Opção de recusar / adiar complemento ("não tenho") passou.');
    }

    // Scenario 7: Address confirmation and freight calculation
    {
        const context = createBaseContext();
        context.order_context.delivery.method = 'delivery';
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'address_confirmation';
        context.order_context.delivery.address = { cep: '56320690', street: 'Rua João Pessoa', district: 'Centro', city: 'Petrolina', state: 'PE', number: '125' };

        // 1. Confirm address
        let res = await handle('sim, está correto', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.shipping_fee, 20.00);
        assert.strictEqual(res.context.order_context.delivery.shipping_deadline, 3);
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'freight_confirmation');

        // 2. Confirm freight
        res = await handle('podemos continuar', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.delivery.shipping_confirmed, true);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.PAGAMENTO);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PAGAMENTO });
        console.log('✅ 7. Fluxo de confirmação de endereço, frete e avanço de fluxo passou.');
    }

    // Scenario 8: Product switch during delivery flow
    {
        const context = createBaseContext();
        context.order_context.delivery.method = 'delivery';
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'address_input';

        const res = await handle('Quero mudar para o POCO X8', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.cart.product_id, 104);
        assert.strictEqual(res.context.order_context.cart.selected_memory, null);
        assert.strictEqual(res.context.order_context.cart.selected_color, null);
        assert.strictEqual(res.context.order_context.delivery.method, undefined); // Cleared
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PRODUTO });
        console.log('✅ 8. Troca de produto no meio da EntregaSkill e limpeza de contexto passou.');
    }

    // Scenario 9: Action resolveAddress error handling (ERP unavailable)
    {
        const context = createBaseContext();
        context.order_context.delivery.method = 'delivery';
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'address_input';

        // Simulate database fail
        mockDb.shouldFail = true;
        try {
            const res = await handle('Rua João Pessoa, 125, CEP 56320-690', context);
            assert.strictEqual(res.success, true);
            assert.ok(res.response.includes('Não consegui confirmar esse endereço agora'));
        } finally {
            mockDb.shouldFail = false;
        }
        console.log('✅ 9. Tratamento de exceção de ERP indisponível com resposta amigável passou.');
    }

    console.log('\n🎉 Todos os testes da EntregaSkill passaram com sucesso!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes de EntregaSkill:', err);
    process.exit(1);
});
