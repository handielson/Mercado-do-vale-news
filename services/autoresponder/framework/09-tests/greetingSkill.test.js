import assert from 'assert';
import { handle } from '../05-skills/GreetingSkill.js';
import { SKILLS, STATES, WAITING_FOR } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import ConversationPolicy from '../03-policies/ConversationPolicy.js';
import ValidationPolicy from '../03-policies/ValidationPolicy.js';
import GeneralPolicy from '../03-policies/GeneralPolicy.js';

// Setup active policies
PolicyEngine.clear();
PolicyEngine.register(GeneralPolicy);
PolicyEngine.register(ConversationPolicy);
PolicyEngine.register(ValidationPolicy);

function createBaseContext() {
    return {
        conversation_id: 'test-uuid-999',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: {
                flow: SKILLS.SAUDACAO,
                step: STATES.INIT,
                waiting_for: WAITING_FOR.NONE,
                expires_at: null
            },
            conversation: {
                last_message_at: null,
                last_bot_question: null,
                message_count: 0
            },
            routing: {
                last_intent: null,
                previous_skills: [],
                last_action: null,
                validation_status: 'pending'
            }
        },
        order_context: {
            cart: { product_id: null, model_name: null, quantity: null, color: null, memory: null },
            delivery: { method: null, cep: null, address_details: null, shipping_fee: null },
            payment: { method: null, installments: null, amount: null }
        },
        customer_context: {
            name: null,
            cpf: null,
            phone: null,
            last_delivery_address: null,
            customer_tier: null
        }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da GreetingSkill.js...');

    // Scenario 1: Simple greeting ("Oi")
    {
        const context = createBaseContext();
        const res = await handle('Oi', context);
        
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Como posso te ajudar hoje?'));
        assert.strictEqual(res.routing, null);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.SAUDACAO);
        assert.strictEqual(res.context.conversation_context.routing.last_intent, 'greeting');
        console.log('✅ 1. Saudação simples tratada corretamente.');
    }

    // Scenario 2: Greeting + Product Intent ("Oi, quero um Redmi")
    {
        const context = createBaseContext();
        const res = await handle('Oi, quero um Redmi', context);
        
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Seja bem-vindo'));
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.PRODUTO });
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.PRODUTO);
        console.log('✅ 2. Saudação + Intenção de Produto roteada corretamente.');
    }

    // Scenario 3: Greeting + Hours Intent ("Bom dia, vocês estão abertos?")
    {
        const context = createBaseContext();
        const res = await handle('Bom dia, vocês estão abertos?', context);
        
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.HORARIO });
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.HORARIO);
        console.log('✅ 3. Saudação + Intenção de Horário roteada corretamente.');
    }

    // Scenario 4: Greeting + Address Intent ("Olá, onde fica a loja?")
    {
        const context = createBaseContext();
        const res = await handle('Olá, onde fica a loja?', context);
        
        assert.strictEqual(res.success, true);
        assert.deepStrictEqual(res.routing, { nextSkill: SKILLS.ENDERECO_LOJA });
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.ENDERECO_LOJA);
        console.log('✅ 4. Saudação + Intenção de Endereço roteada corretamente.');
    }

    // Scenario 5: Isolated name during active conversation flow
    {
        const context = createBaseContext();
        // Simulate active product flow in progress
        context.conversation_context.state.flow = SKILLS.PRODUTO;
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        
        const res = await handle('João', context);
        
        // Should ignore and return blank response, without modifying the active flow
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.response, '');
        assert.strictEqual(res.routing, null);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.PRODUTO);
        console.log('✅ 5. Nome isolado durante conversa ativa ignorado corretamente.');
    }

    // Scenario 6: Continuation word ("sim") during active conversation flow
    {
        const context = createBaseContext();
        context.conversation_context.state.flow = SKILLS.PRODUTO;
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        
        const res = await handle('sim', context);
        
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.response, '');
        assert.strictEqual(res.routing, null);
        console.log('✅ 6. Mensagem curta de continuação ignorada corretamente.');
    }

    console.log('\n🎉 Todos os testes da GreetingSkill passaram!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes da GreetingSkill:', err);
    process.exit(1);
});
