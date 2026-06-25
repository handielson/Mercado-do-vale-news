import assert from 'assert';
import { handle } from '../05-skills/PaymentSkill.js';
import * as PaymentService from '../04-actions/PaymentService.js';
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
    shouldTimeout: false,
    shouldFail: false,
    products: [
        { id: 101, name: 'Redmi Note 15', sku: 'REDMI-15-256', price: 1499.00, brand: 'Xiaomi', model: 'Note 15', memory: '256GB', stock_quantity: 10, active: 1, bling_parent_id: 1000 }
    ],
    query: async function(sql, values = []) {
        if (this.shouldTimeout) {
            throw new Error('ETIMEDOUT: Connection pool timeout exceeded');
        }
        if (this.shouldFail) {
            throw new Error('ER_CON_COUNT_ERROR: Too many connections');
        }

        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ');

        // SELECT price from products
        if (cleanSql.includes('SELECT PRICE FROM PRODUCTS')) {
            const id = values[0];
            const prod = this.products.find(p => p.id === Number(id));
            return prod ? [[prod]] : [[]];
        }

        return [[]];
    }
};

function createBaseContext() {
    return {
        conversation_id: 'test-payment-888',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: { flow: SKILLS.PAGAMENTO, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
        },
        order_context: {
            cart: { product_id: 101, model: 'Redmi Note 15', selected_memory: '256GB', selected_color: 'Blue', quantity: 1 },
            delivery: { method: 'pickup', shipping_fee: 0 },
            payment: {}
        },
        customer_context: { name: 'João', cpf: null, phone: '5587999999999', last_delivery_address: null, customer_tier: 'Regular' }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da PaymentSkill.js...');
    PaymentService.init(mockDb);

    // Scenario 1: Initial load, list methods
    {
        const context = createBaseContext();
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Como você deseja realizar o pagamento'));
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'payment_method_selection');
        console.log('✅ 1. Exibição inicial das formas de pagamento passou.');
    }

    // Scenario 2: Select PIX (No freight) & Confirm
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_method_selection';

        // 1. Select PIX
        let res = await handle('pix', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.method, 'pix');
        assert.strictEqual(res.context.order_context.payment.total, 1499.00 * 0.95);
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'payment_confirmation');
        assert.ok(res.response.includes('Confirmado'));

        // 2. Confirm payment
        res = await handle('sim, pode ser', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.RESUMO);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.RESUMO });
        console.log('✅ 2. Fluxo de pagamento com PIX (sem frete) e confirmação passou.');
    }

    // Scenario 3: Select Dinheiro (With freight R$ 20) & Confirm
    {
        const context = createBaseContext();
        context.order_context.delivery = { method: 'delivery', shipping_fee: 20.00 };
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_method_selection';

        // 1. Select Dinheiro
        let res = await handle('dinheiro', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.method, 'dinheiro');
        assert.strictEqual(res.context.order_context.payment.total, 1499.00 + 20.00); // base price + shipping_fee
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'payment_confirmation');

        // 2. Confirm payment
        res = await handle('continuar', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.RESUMO);
        console.log('✅ 3. Fluxo de pagamento em dinheiro (com frete) e confirmação passou.');
    }

    // Scenario 4: Credit Card - Select installments and confirm
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_method_selection';

        // 1. Select Credit Card
        let res = await handle('cartão de crédito', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.method, 'cartao');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'installments_input');
        assert.ok(res.response.includes('12x de R$'));

        // 2. Select 6 installments
        res = await handle('em 6 vezes', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.installments, 6);
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'payment_confirmation');
        assert.ok(res.response.includes('6x de R$'));

        // 3. Confirm
        res = await handle('sim', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.RESUMO);
        console.log('✅ 4. Fluxo de parcelamento no cartão de crédito passou.');
    }

    // Scenario 5: Mixed Payment - Entrada + Card Balance Installments
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_method_selection';

        // 1. Select Mixed
        let res = await handle('pagamento misto', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.method, 'misto');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'down_payment_input');
        assert.ok(res.response.includes('Qual será o valor da entrada'));

        // 2. Send downpayment amount
        res = await handle('R$ 499,00', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.down_payment, 499);
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'misto_installments_input');
        assert.ok(res.response.includes('Resta o saldo de R$ 1000.00'));

        // 3. Select 3 installments for balance
        res = await handle('3x', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.installments, 3);
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'payment_confirmation');

        // 4. Confirm
        res = await handle('pode continuar', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.RESUMO);
        console.log('✅ 5. Fluxo de pagamento misto passou.');
    }

    // Scenario 6: Alteration of payment method after selecting installments
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'installments_input';
        context.order_context.payment = {
            method: 'cartao',
            simulation: {
                card_options: [{ installment: 6, amount_per_month: 250, total: 1500 }]
            }
        };

        // Customer changes mind to PIX
        let res = await handle('mudar para PIX', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.payment.method, 'pix');
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'payment_confirmation');
        assert.ok(res.response.includes('Confirmado! O valor final para pagamento no PIX'));
        console.log('✅ 6. Alteração dinâmica de forma de pagamento após escolher parcelas passou.');
    }

    // Scenario 7: Negative confirmation ("quero mudar") restarts flow
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_confirmation';
        context.order_context.payment = {
            method: 'pix',
            total: 1424.05
        };

        let res = await handle('não, quero mudar', context);
        assert.strictEqual(res.success, true);
        // Payment is cleared, flow restarts at method selection listing
        assert.strictEqual(res.context.order_context.payment.method, undefined);
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'payment_method_selection');
        assert.ok(res.response.includes('Como você deseja realizar o pagamento'));
        console.log('✅ 7. Confirmação negativa ("quero mudar") reiniciando o fluxo passou.');
    }

    // Scenario 8: ERP Offline Exception Handling
    {
        const context = createBaseContext();
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_method_selection';

        mockDb.shouldFail = true;
        try {
            const res = await handle('pix', context);
            assert.strictEqual(res.success, true);
            assert.ok(res.response.includes('Não consegui calcular essa forma de pagamento agora'));
        } finally {
            mockDb.shouldFail = false;
        }
        console.log('✅ 8. Tratamento de exceção de ERP offline passou.');
    }

    console.log('\n🎉 Todos os testes da PaymentSkill passaram com sucesso!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes de PaymentSkill:', err);
    process.exit(1);
});
