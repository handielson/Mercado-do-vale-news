import assert from 'assert';
import crypto from 'crypto';
import { handle } from '../05-skills/FinalizacaoSkill.js';
import * as OrderService from '../04-actions/OrderService.js';
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
    shouldFail: false,
    queriesRun: [],
    orders: [],
    query: async function(sql, values = []) {
        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ').trim();
        this.queriesRun.push({ sql: cleanSql, values });

        if (this.shouldFail && cleanSql.includes('INSERT')) {
            throw new Error('DATABASE_CONNECTION_LOST');
        }

        // Simulates idempotency select check
        if (cleanSql.includes('FROM ORDERS WHERE STATUS = ?')) {
            const statusKey = values[0];
            const found = this.orders.find(o => o.status === statusKey);
            return found ? [[found]] : [[]];
        }

        // Simulates START TRANSACTION, COMMIT, ROLLBACK
        if (cleanSql.includes('START TRANSACTION') || cleanSql.includes('COMMIT') || cleanSql.includes('ROLLBACK')) {
            return [[]];
        }

        // Simulates insert order
        if (cleanSql.startsWith('INSERT INTO ORDERS')) {
            const newOrder = {
                id: 601,
                total_amount: values[0],
                status: values[1], // holds idempotencyKey
                shipping_fee: values[2],
                payment_method: values[3]
            };
            this.orders.push(newOrder);
            return [{ insertId: 601 }];
        }

        // Simulates insert order items
        if (cleanSql.startsWith('INSERT INTO ORDER_ITEMS')) {
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }
};

function createBaseContext() {
    const snapshot = {
        cart: { product_id: 101, model_name: 'Redmi Note 15', memory: '256GB', color: 'Blue', quantity: 1 },
        benefits: { screen_protector: { eligible: true, accepted: true } },
        delivery: { method: 'pickup', shipping_fee: 0, shipping_deadline: 0 },
        payment: { method: 'pix', total: 1424.05, installments: 1, down_payment: 0, installment_value: 1424.05 }
    };
    const hash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

    return {
        conversation_id: 'test-finalize-123',
        framework_version: '1.0.0',
        schema_version: 1,
        conversation_context: {
            state: { flow: SKILLS.FINALIZACAO, step: STATES.INIT, waiting_for: WAITING_FOR.NONE, expires_at: null },
            conversation: { last_message_at: null, last_bot_question: null, message_count: 0 },
            routing: { last_intent: null, previous_skills: [], last_action: null, validation_status: 'pending' }
        },
        order_context: {
            cart: { product_id: 101 },
            confirmation: { version: 1, status: 'confirmed', summaryHash: hash, generatedAt: new Date().toISOString() },
            snapshots: {
                current: snapshot,
                confirmed: snapshot
            }
        },
        customer_context: { name: 'João', cpf: null, phone: '5587999999999', last_delivery_address: null, customer_tier: 'Regular' }
    };
}

async function testSuite() {
    console.log('🧪 Iniciando testes da FinalizacaoSkill.js...');
    OrderService.init(mockDb);

    // 1. Successful Finalization & Event emission
    {
        mockDb.orders = [];
        mockDb.queriesRun = [];
        mockDb.shouldFail = false;

        let eventTriggered = false;
        let eventPayload = null;
        OrderService.orderEvents.once('ORDER_CREATED', (data) => {
            eventTriggered = true;
            eventPayload = data;
        });

        const context = createBaseContext();
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Pedido realizado com sucesso'));
        assert.strictEqual(res.context.conversation_context.finished, true);
        assert.strictEqual(res.context.conversation_context.state.step, 'completed');
        assert.strictEqual(res.context.order_context.order.number, 'MDV-601');
        assert.strictEqual(res.context.order_context.audit.finalizedBy, 'AI');

        // Allow setImmediate event queue execution check
        await new Promise(resolve => setImmediate(resolve));
        assert.strictEqual(eventTriggered, true);
        assert.strictEqual(eventPayload.orderNumber, 'MDV-601');
        console.log('✅ 1. Pedido criado com sucesso e evento ORDER_CREATED publicado.');
    }

    // 2. Skill Idempotency Check (conversa finalizada)
    {
        const context = createBaseContext();
        context.conversation_context.finished = true;
        context.order_context.order = { number: 'MDV-601', protocol: 'PRT601' };

        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Seu pedido já foi realizado'));
        assert.strictEqual(res.routing, null);
        console.log('✅ 2. Idempotência no fluxo conversacional passou.');
    }

    // 3. Idempotency Key check in OrderService
    {
        mockDb.orders = [{ id: 601, total_amount: 1424.05, status: 'IDEM-test-finalize-123-1', shipping_fee: 0, payment_method: 'pix' }];
        mockDb.queriesRun = [];

        const context = createBaseContext();
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.context.order_context.order.number, 'MDV-601');

        // Check SQL check check SQL was run but INSERT was bypassed
        const selectQuery = mockDb.queriesRun.find(q => q.sql.includes('SELECT ID, TOTAL_AMOUNT FROM ORDERS WHERE STATUS = ?'));
        assert.ok(selectQuery !== undefined);
        const insertQuery = mockDb.queriesRun.find(q => q.sql.includes('INSERT INTO ORDERS'));
        assert.ok(insertQuery === undefined); // Bypassed insert!
        console.log('✅ 3. Idempotency Key interceptada pela Action evitando inserção duplicada passou.');
    }

    // 4. Transactional Error & Rollback
    {
        mockDb.orders = [];
        mockDb.queriesRun = [];
        mockDb.shouldFail = true; // DB fails

        const context = createBaseContext();
        const res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.ok(res.response.includes('Não foi possível concluir seu pedido'));
        assert.strictEqual(res.context.conversation_context.finished, undefined);

        // Verification of transaction management queries
        const startTx = mockDb.queriesRun.find(q => q.sql.includes('START TRANSACTION'));
        const rollbackTx = mockDb.queriesRun.find(q => q.sql.includes('ROLLBACK'));
        assert.ok(startTx !== undefined);
        assert.ok(rollbackTx !== undefined); // Rollback was triggered!
        console.log('✅ 4. Rollback atômico disparado em falha transacional passou.');
    }

    // 5. Invalid Snapshot & Hash check
    {
        mockDb.shouldFail = false;

        // 5.1 Invalid Confirmation Status
        const context = createBaseContext();
        context.order_context.confirmation.status = 'invalidated';
        let res = await handle('', context);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.routing.nextSkill, SKILLS.RESUMO);

        // 5.2 Hash mismatch
        const context2 = createBaseContext();
        context2.order_context.confirmation.summaryHash = 'wronghash';
        res = await handle('', context2);
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.routing.nextSkill, SKILLS.RESUMO);
        console.log('✅ 5. Validação de snapshot e hashes inválidos retornando ao Resumo passou.');
    }

    // 6. Recovery after Connection Lost (Timeout recovery retry)
    {
        mockDb.orders = [];
        mockDb.queriesRun = [];
        
        // Fail first time
        mockDb.shouldFail = true;
        const context = createBaseContext();
        let res = await handle('', context);
        assert.strictEqual(res.context.conversation_context.finished, undefined);

        // Recover and succeed second time
        mockDb.shouldFail = false;
        res = await handle('', res.context);
        assert.strictEqual(res.context.conversation_context.finished, true);
        assert.strictEqual(res.context.order_context.order.number, 'MDV-601');
        console.log('✅ 6. Recuperação e nova tentativa com sucesso após falha temporária do ERP passou.');
    }

    console.log('\n🎉 Todos os testes da FinalizacaoSkill passaram com sucesso!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes de FinalizacaoSkill:', err);
    process.exit(1);
});
