import assert from 'assert';
import { handle } from '../00-kernel/Kernel.js';
import * as contextManager from '../01-context/contextManager.js';
import { SKILLS, STATES, WAITING_FOR } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import GeneralPolicy from '../03-policies/GeneralPolicy.js';
import ConversationPolicy from '../03-policies/ConversationPolicy.js';
import ValidationPolicy from '../03-policies/ValidationPolicy.js';

import * as ProductService from '../04-actions/ProductService.js';
import * as DeliveryService from '../04-actions/DeliveryService.js';
import * as OrderService from '../04-actions/OrderService.js';
import * as PaymentService from '../04-actions/PaymentService.js';

// Setup Policies
PolicyEngine.clear();
PolicyEngine.register(GeneralPolicy);
PolicyEngine.register(ConversationPolicy);
PolicyEngine.register(ValidationPolicy);

// Mock DB
const mockDb = {
    records: {},
    queries: [],
    query: async function(sql, values = []) {
        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ').trim();
        this.queries.push({ sql: cleanSql, values });

        // Select context
        if (cleanSql.startsWith('SELECT') && cleanSql.includes('AUTORESPONDER_AI_CONTEXT')) {
            const [channel, sender] = values;
            const key = `${channel}:${sender}`;
            if (this.records[key]) {
                return [[this.records[key]]];
            }
            return [[]];
        }

        // Insert/Update context
        if (cleanSql.startsWith('INSERT') && cleanSql.includes('AUTORESPONDER_AI_CONTEXT')) {
            const [channel, sender, conversation_id, framework_version, schema_version, conversation_context, order_context, customer_context] = values;
            const key = `${channel}:${sender}`;
            this.records[key] = {
                channel,
                sender,
                conversation_id,
                framework_version,
                schema_version,
                conversation_context,
                order_context,
                customer_context
            };
            return [{ affectedRows: 1 }];
        }

        // Action queries simulation (e.g. Products catalog, orders)
        if (cleanSql.includes('FROM PRODUCTS')) {
            return [[{ id: 101, name: 'Redmi Note 15', sku: 'redmi-15', price: 1499.00, stock_quantity: 5 }]];
        }

        return [[]];
    },
    reset: function() {
        this.records = {};
        this.queries = [];
    }
};

import { init as kernelInit, mockDbInstance } from '../00-kernel/Kernel.js';

// Initialize the Kernel with mockDb as the real database pool
kernelInit(mockDb);

async function testSuite() {
    console.log('🧪 Iniciando testes do Kernel.js...');

    // 1. Successful message processing and trace generation
    {
        mockDb.reset();
        const res = await handle('Olá, quero comprar um celular', 'whatsapp', '5587999999999');

        assert.ok(res.response !== undefined);
        assert.ok(res.response.length > 0);
        if (res.context === null) {
            console.error('Fatal errors in Kernel:', res.trace.errors);
            console.error('Logs:', res.logs);
        }
        assert.ok(res.context !== null);
        assert.ok(res.context !== undefined);
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.PRODUTO);
        
        // Assert trace structure
        assert.ok(res.trace !== undefined);
        assert.ok(res.trace.sessionId !== undefined);
        assert.ok(res.trace.sessionId.startsWith('SES-'));
        assert.strictEqual(res.trace.kernel.message, 'Olá, quero comprar um celular');
        assert.strictEqual(res.trace.kernel.channel, 'whatsapp');
        assert.strictEqual(res.trace.kernel.sender, '5587999999999');
        assert.ok(res.trace.skills.length > 0);
        assert.strictEqual(res.trace.skills[0].name, SKILLS.SAUDACAO);
        
        // Assert timings and metrics
        assert.ok(res.metrics !== undefined);
        assert.ok(res.metrics.totalTime > 0);
        assert.ok(res.metrics.kernelTime >= 0);
        assert.ok(res.metrics.skillsTime >= 0);
        assert.ok(res.metrics.policiesTime >= 0);
        
        // Assert structured logs
        assert.ok(res.logs !== undefined);
        assert.ok(res.logs.length > 0);
        const logEntry = res.logs[0];
        assert.ok(logEntry.timestamp !== undefined);
        assert.ok(logEntry.level !== undefined);
        assert.strictEqual(logEntry.source, 'KERNEL');
        assert.strictEqual(logEntry.event, 'MESSAGE_RECEIVED');
        console.log('✅ 1. Processamento de mensagem e geração de trace/métricas funcionaram.');
    }

    // 2. Feature Flags: disabled skill redirect
    {
        mockDb.reset();
        
        // Setup context to be on PRODUCT skill, but disable PRODUCT in options
        const contextKey = 'whatsapp:5587888888888';
        mockDb.records[contextKey] = {
            channel: 'whatsapp',
            sender: '5587888888888',
            conversation_id: 'conv-999',
            framework_version: '1.0.0',
            schema_version: 1,
            conversation_context: JSON.stringify({
                state: { flow: SKILLS.PRODUTO, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
                conversation: { last_message_at: null, last_bot_question: null, message_count: 1 },
                routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
            }),
            order_context: JSON.stringify({}),
            customer_context: JSON.stringify({ name: 'User' })
        };

        const options = {
            activeSkills: {
                [SKILLS.PRODUTO]: false // Disabled!
            }
        };

        const res = await handle('Ola', 'whatsapp', '5587888888888', options);
        
        // Check that it warned and redirected to SAUDACAO
        assert.ok(res.trace.warnings.some(w => w.includes('desativada')));
        assert.strictEqual(res.context.conversation_context.state.flow, SKILLS.SAUDACAO);
        console.log('✅ 2. Feature Flags interceptaram skill desativada e redirecionaram com aviso.');
    }

    // 3. Mock Mode / Real Mode execution flags
    {
        mockDb.reset();
        
        // In mock mode, we pass options.mockMode = true. Check if it writes context.mockMode = true.
        const resMock = await handle('Ola', 'whatsapp', '5587777777777', { mockMode: true });
        assert.strictEqual(resMock.context.mockMode, true);

        // In normal mode, it should be false/undefined
        const resNormal = await handle('Ola', 'whatsapp', '5587777777777', { mockMode: false });
        assert.strictEqual(resNormal.context.mockMode, false);
        console.log('✅ 3. Modo Mock/Real propagados corretamente para o contexto de execução.');
    }

    // 4. Trace validation on Action execution
    {
        mockDb.reset();
        
        // ProductSkill invokes ProductService.getProduct when context is set
        const contextKey = 'whatsapp:5587666666666';
        mockDb.records[contextKey] = {
            channel: 'whatsapp',
            sender: '5587666666666',
            conversation_id: 'conv-888',
            framework_version: '1.0.0',
            schema_version: 1,
            conversation_context: JSON.stringify({
                state: { flow: SKILLS.PRODUTO, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
                conversation: { last_message_at: null, last_bot_question: null, message_count: 1 },
                routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
            }),
            order_context: JSON.stringify({
                cart: { product_id: 101 }
            }),
            customer_context: JSON.stringify({ name: 'User' })
        };

        const res = await handle('Quero ver detalhes', 'whatsapp', '5587666666666');
        
        // Verify that the action was traced
        const actions = res.trace.actions;
        console.log('TRACED ACTIONS:', actions);
        assert.ok(actions.length > 0);
        assert.ok(actions.some(a => a.name === 'ProductService.getProductPresentation'));
        assert.ok(actions[0].duration >= 0);
        assert.ok(actions[0].timestamp !== undefined);
        console.log('✅ 4. Ações de serviços interceptadas e registradas no trace com sucesso.');
    }

    // 5. Multiple simultaneous sessions (Concurrent isolation)
    {
        mockDb.reset();
        
        const p1 = handle('Olá do usuário 1', 'whatsapp', 'user-1');
        const p2 = handle('Olá do usuário 2', 'whatsapp', 'user-2');

        const [r1, r2] = await Promise.all([p1, p2]);

        assert.strictEqual(r1.trace.kernel.sender, 'user-1');
        assert.strictEqual(r2.trace.kernel.sender, 'user-2');
        assert.notStrictEqual(r1.trace.sessionId, r2.trace.sessionId);
        console.log('✅ 5. Isolamento simultâneo de sessões e concorrência validados.');
    }

    // 6. Conversation Reset / Resetting contexts
    {
        mockDb.reset();
        
        // Load, interact
        await handle('Ola', 'whatsapp', 'user-reset');
        
        // Verify context is saved in db
        const contextKey = 'whatsapp:user-reset';
        assert.ok(mockDb.records[contextKey] !== undefined);
        
        // Reset contexts
        await contextManager.clearConversationContext('whatsapp', 'user-reset');
        await contextManager.clearOrderContext('whatsapp', 'user-reset');
        await contextManager.clearCustomerContext('whatsapp', 'user-reset');

        // Load again and verify clean slate
        const resAfterReset = await handle('Ola', 'whatsapp', 'user-reset');
        assert.strictEqual(resAfterReset.context.conversation_context.conversation.message_count, 1);
        assert.strictEqual(resAfterReset.context.order_context.cart.product_id, null);
        console.log('✅ 6. Reinício de conversa e limpeza do Context Manager validados.');
    }

    console.log('\n🎉 Todos os testes do Kernel passaram com sucesso!');
}

testSuite().catch(err => {
    console.error('❌ Falha nos testes do Kernel:', err);
    process.exit(1);
});
