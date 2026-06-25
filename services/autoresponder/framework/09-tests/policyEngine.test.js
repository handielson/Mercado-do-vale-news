import assert from 'assert';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import GeneralPolicy from '../03-policies/GeneralPolicy.js';
import ConversationPolicy from '../03-policies/ConversationPolicy.js';
import ProductPolicy from '../03-policies/ProductPolicy.js';
import PaymentPolicy from '../03-policies/PaymentPolicy.js';
import DeliveryPolicy from '../03-policies/DeliveryPolicy.js';
import SecurityPolicy from '../03-policies/SecurityPolicy.js';
import ValidationPolicy from '../03-policies/ValidationPolicy.js';
import WhatsAppPolicy from '../03-policies/WhatsAppPolicy.js';
import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';

// Register all policies in the engine
PolicyEngine.register(GeneralPolicy);
PolicyEngine.register(ConversationPolicy);
PolicyEngine.register(ProductPolicy);
PolicyEngine.register(PaymentPolicy);
PolicyEngine.register(DeliveryPolicy);
PolicyEngine.register(SecurityPolicy);
PolicyEngine.register(ValidationPolicy);
PolicyEngine.register(WhatsAppPolicy);

// Helper to create a valid base context
function createValidContext() {
    return {
        conversation_id: 'test-uuid-1234',
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
                last_message_at: new Date().toISOString(),
                last_bot_question: 'Qual o seu nome?',
                message_count: 2
            },
            routing: {
                last_intent: 'greeting',
                previous_skills: [],
                last_action: null,
                validation_status: VALIDATION.PENDING
            }
        },
        order_context: {
            cart: { product_id: null, model_name: null, quantity: null, color: null, memory: null },
            delivery: { method: null, cep: null, address_details: null, shipping_fee: null },
            payment: { method: null, installments: null, amount: null }
        },
        customer_context: {
            name: 'João Teste',
            cpf: '123.456.789-00',
            phone: '5587999999999',
            last_delivery_address: null,
            customer_tier: 'STANDARD'
        }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes do PolicyEngine.js e das Policies...');

    // Test 1: Full success case (Approved response)
    {
        const context = createValidContext();
        const response = 'Olá! Seja bem-vindo ao Mercado do Vale. Como posso te ajudar hoje?';
        const result = PolicyEngine.validate(response, context);
        
        assert.strictEqual(result.approved, true);
        assert.strictEqual(result.violations.length, 0);
        console.log('✅ 1. Resposta válida aprovada com sucesso.');
    }

    // Test 2: GeneralPolicy - Missing Context
    {
        const result = PolicyEngine.validate('Olá!', null);
        assert.strictEqual(result.approved, false);
        assert.ok(result.violations.some(v => v.code === 'MISSING_CONTEXT'));
        console.log('✅ 2. Detecção de contexto ausente (GeneralPolicy) passou.');
    }

    // Test 3: ConversationPolicy - Multiple Questions
    {
        const context = createValidContext();
        const response = 'Qual produto você procura? Já sabe o modelo?';
        const result = PolicyEngine.validate(response, context);
        assert.strictEqual(result.approved, false);
        assert.ok(result.violations.some(v => v.code === 'MULTIPLE_QUESTIONS'));
        console.log('✅ 3. Detecção de múltiplas perguntas (ConversationPolicy) passou.');
    }

    // Test 4: ProductPolicy - Stock Quantity Leak
    {
        const context = createValidContext();
        const response = 'O Redmi Note 15 está disponível. Temos 5 unidades em estoque no momento!';
        const result = PolicyEngine.validate(response, context);
        assert.strictEqual(result.approved, false);
        assert.ok(result.violations.some(v => v.code === 'EXPOSED_STOCK_QUANTITY'));
        console.log('✅ 4. Bloqueio de exposição de estoque físico (ProductPolicy) passou.');
    }

    // Test 5: ProductPolicy - Format presentation validation
    {
        const context = createValidContext();
        // Emits emojis suggesting product details but layout is incorrect
        const response = '📱 Redmi Note 15\n💰 R$ 1500,00'; 
        const result = PolicyEngine.validate(response, context);
        assert.strictEqual(result.approved, false);
        assert.ok(result.violations.some(v => v.code === 'INVALID_PRODUCT_FORMAT'));
        console.log('✅ 5. Validação de formato obrigatório de produto (ProductPolicy) passou.');
    }

    // Test 6: PaymentPolicy - Boleto prohibited
    {
        const context = createValidContext();
        const response = 'Infelizmente não aceitamos boleto bancário como forma de pagamento.';
        const result = PolicyEngine.validate(response, context);
        assert.strictEqual(result.approved, false);
        assert.ok(result.violations.some(v => v.code === 'BOLETO_PROHIBITED'));
        console.log('✅ 6. Bloqueio de termos de boleto (PaymentPolicy) passou.');
    }

    // Test 7: SecurityPolicy - SQL Keyword and stack trace leaks
    {
        const context = createValidContext();
        const sqlResponse = 'Erro interno: SELECT * FROM products WHERE id = 1';
        const stackResponse = 'TypeError: Cannot read property of undefined at async processMessage';
        
        const sqlResult = PolicyEngine.validate(sqlResponse, context);
        assert.strictEqual(sqlResult.approved, false);
        assert.ok(sqlResult.violations.some(v => v.code === 'SQL_EXPOSURE_DETECTED'));

        const stackResult = PolicyEngine.validate(stackResponse, context);
        assert.strictEqual(stackResult.approved, false);
        assert.ok(stackResult.violations.some(v => v.code === 'TECHNICAL_EXPOSURE_DETECTED'));
        
        console.log('✅ 7. Bloqueio de vazamentos de banco e dados técnicos (SecurityPolicy) passou.');
    }

    // Test 8: ValidationPolicy - Framework structure validation
    {
        const context = createValidContext();
        delete context.framework_version; // invalidate version
        const result = PolicyEngine.validate('Olá!', context);
        assert.strictEqual(result.approved, false);
        assert.ok(result.violations.some(v => v.code === 'MISSING_FRAMEWORK_VERSION'));
        console.log('✅ 8. Validação de versões internas (ValidationPolicy) passou.');
    }

    // Test 9: WhatsAppPolicy - Message length check
    {
        const context = createValidContext();
        const response = 'a'.repeat(4001); // Exceeds 4000
        const result = PolicyEngine.validate(response, context);
        assert.strictEqual(result.approved, false);
        assert.ok(result.violations.some(v => v.code === 'MESSAGE_TOO_LONG'));
        console.log('✅ 9. Validação de limite máximo de tamanho de mensagem (WhatsAppPolicy) passou.');
    }

    console.log('\n🎉 Todos os testes de políticas e do PolicyEngine passaram!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes de políticas:', err);
    process.exit(1);
});
