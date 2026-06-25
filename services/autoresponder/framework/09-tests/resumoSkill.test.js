import assert from 'assert';
import { handle } from '../05-skills/ResumoSkill.js';
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

function createBaseContext() {
    return {
        conversation_id: 'test-summary-999',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: { flow: SKILLS.RESUMO, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
        },
        order_context: {
            cart: { product_id: 101, model: 'Redmi Note 15', selected_memory: '256GB', selected_color: 'Blue', quantity: 1 },
            delivery: {
                method: 'delivery',
                raw_cep: '56320690',
                address: { cep: '56320690', street: 'Rua João Pessoa', district: 'Centro', city: 'Petrolina', state: 'PE' },
                number: '125',
                complement: 'Apto 302',
                shipping_fee: 20.00,
                shipping_deadline: 3
            },
            payment: {
                method: 'pix',
                installments: 1,
                down_payment: 0,
                total: 1424.05,
                installment_value: 1424.05,
                simulation: { pix_amount: 1424.05, base_amount: 1499.00 }
            },
            benefits: {
                screen_protector: { eligible: true, accepted: true },
                case: { eligible: true, accepted: true, color: 'Azul' }
            }
        },
        customer_context: { name: 'João', cpf: null, phone: '5587999999999', last_delivery_address: null, customer_tier: 'Regular' }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da ResumoSkill.js...');

    // 1. Full Summary Presentation (Delivery + PIX)
    {
        const context = createBaseContext();
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('📝 Resumo do seu Pedido'));
        assert.ok(res.response.includes('Redmi Note 15'));
        assert.ok(res.response.includes('Capinha de silicone na cor Azul'));
        assert.ok(res.response.includes('Entrega por Delivery'));
        assert.ok(res.response.includes('PIX à vista'));
        assert.strictEqual(res.context.conversation_context.state.waiting_for, 'final_confirmation');
        assert.strictEqual(res.context.order_context.confirmation.status, 'pending');
        assert.ok(res.context.order_context.snapshots.current !== null);
        console.log('✅ 1. Apresentação de resumo completo de entrega com PIX passou.');
    }

    // 2. Pickup formatting
    {
        const context = createBaseContext();
        context.order_context.delivery = { method: 'pickup', shipping_fee: 0 };
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Retirada na loja física (Sem frete)'));
        console.log('✅ 2. Formatação de recebimento por retirada passou.');
    }

    // 3. Card formatting
    {
        const context = createBaseContext();
        context.order_context.payment = {
            method: 'cartao',
            installments: 6,
            down_payment: 0,
            total: 1520.00,
            installment_value: 253.33,
            simulation: { card_options: [] }
        };
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('6x de R$ 253.33'));
        console.log('✅ 3. Formatação de pagamento parcelado no cartão passou.');
    }

    // 4. Mixed payment formatting
    {
        const context = createBaseContext();
        context.order_context.payment = {
            method: 'misto',
            installments: 3,
            down_payment: 500.00,
            total: 1515.00,
            installment_value: 338.33,
            simulation: {}
        };
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Entrada de R$ 500.00 + 3x de R$ 338.33 no Cartão'));
        console.log('✅ 4. Formatação de pagamento misto passou.');
    }

    // 5. Positive Confirmation (snapshots.confirmed generation)
    {
        const context = createBaseContext();
        let res = await handle('', context); // Load summary
        assert.strictEqual(res.context.order_context.confirmation.status, 'pending');
        assert.strictEqual(res.context.order_context.snapshots.confirmed, null);

        // Confirm
        res = await handle('sim, tudo correto', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.confirmation.status, 'confirmed');
        assert.deepStrictEqual(res.context.order_context.snapshots.confirmed.cart, res.context.order_context.snapshots.current.cart);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.FINALIZACAO);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.FINALIZACAO });
        console.log('✅ 5. Confirmação positiva com geração do snapshot.confirmed imutável passou.');
    }

    // 6. Negative Confirmation ("não")
    {
        const context = createBaseContext();
        let res = await handle('', context);
        res = await handle('não, está errado', res.context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.confirmation.status, 'invalidated');
        assert.strictEqual(res.context.order_context.confirmation.version, 2);
        assert.ok(res.response.includes('O que você gostaria de alterar'));
        console.log('✅ 6. Confirmação negativa invalidando versão passou.');
    }

    // 7. Missing required fields check and corrective routing
    {
        // 7.1 Missing payment
        const context = createBaseContext();
        context.order_context.payment = {};
        let res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.routing.nextSkill, SKILLS.PAGAMENTO);
        assert.ok(res.response.includes('forma de pagamento não foi definida'));

        // 7.2 Missing delivery
        const context2 = createBaseContext();
        context2.order_context.delivery = {};
        res = await handle('', context2);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.routing.nextSkill, SKILLS.ENTREGA);
        assert.ok(res.response.includes('entrega estão incompletas'));
        console.log('✅ 7. Identificação de dados faltantes e roteamento corretivo passou.');
    }

    // 8. Dynamic routing and automatic invalidation (mudar cor / pagamento)
    {
        const context = createBaseContext();
        let res = await handle('', context);
        assert.strictEqual(res.context.order_context.confirmation.version, 1);

        // 8.1 Change color
        const contextColor = JSON.parse(JSON.stringify(res.context));
        let resColor = await handle('quero trocar a cor', contextColor);
        assert.strictEqual(resColor.success, true);
        assert.strictEqual(resColor.context.order_context.confirmation.status, 'invalidated');
        assert.strictEqual(resColor.context.order_context.confirmation.version, 2);
        assert.strictEqual(resColor.context.order_context.snapshots.confirmed, null);
        assert.strictEqual(resColor.context.conversation_context.state.flow, SKILLS.ESCOLHA_COR);
        assert.deepStrictEqual(resColor.routing, { nextSkill: SKILLS.ESCOLHA_COR });

        // 8.2 Change payment
        const contextPay = JSON.parse(JSON.stringify(res.context));
        let resPay = await handle('mudar forma de pagamento', contextPay);
        assert.strictEqual(resPay.success, true);
        assert.strictEqual(resPay.context.order_context.confirmation.status, 'invalidated');
        assert.strictEqual(resPay.context.order_context.confirmation.version, 2);
        assert.strictEqual(resPay.context.conversation_context.state.flow, SKILLS.PAGAMENTO);
        assert.deepStrictEqual(resPay.routing, { nextSkill: SKILLS.PAGAMENTO });
        console.log('✅ 8. Solicitações de alteração disparando invalidações e incrementos de versão passou.');
    }

    // 9. Hash based exclusively on snapshots.current (changing irrelevant fields does not invalidate summary)
    {
        const context = createBaseContext();
        let res = await handle('', context);
        const originalHash = res.context.order_context.confirmation.summaryHash;

        // Change customer tier (irrelevant to order snapshot)
        res.context.customer_context.customer_tier = 'VIP';
        res.context.conversation_context.conversation.last_bot_question = null; // Clear to prevent REPEATED_QUESTION warning
        let res2 = await handle('', res.context);
        assert.strictEqual(res2.success, true);
        assert.strictEqual(res2.context.order_context.confirmation.summaryHash, originalHash);
        assert.strictEqual(res2.context.order_context.confirmation.status, 'pending'); // not invalidated since hash is same

        // Change color (relevant)
        res2.context.order_context.cart.selected_color = 'Preto';
        res2.context.conversation_context.conversation.last_bot_question = null; // Clear to prevent REPEATED_QUESTION warning
        let res3 = await handle('', res2.context);
        assert.notStrictEqual(res3.context.order_context.confirmation.summaryHash, originalHash);
        assert.strictEqual(res3.context.order_context.confirmation.status, 'pending'); // resets to pending
        assert.strictEqual(res3.context.order_context.confirmation.version, 2); // incremented version on change detected
        console.log('✅ 9. Hash baseado exclusivamente no snapshot.current passou.');
    }

    console.log('\n🎉 Todos os testes da ResumoSkill passaram com sucesso!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes de ResumoSkill:', err);
    process.exit(1);
});
