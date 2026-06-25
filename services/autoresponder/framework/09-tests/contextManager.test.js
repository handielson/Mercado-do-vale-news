import assert from 'assert';
import { 
    init, 
    loadContext, 
    saveContext, 
    clearConversationContext, 
    clearOrderContext, 
    clearCustomerContext 
} from '../01-context/contextManager.js';
import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';

// Setup Mock Pool
const mockDb = {
    records: {},
    queries: [],
    query: async function(sql, values) {
        this.queries.push({ sql, values });
        
        // SELECT query simulation
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
            const [channel, sender] = values;
            const key = `${channel}:${sender}`;
            if (this.records[key]) {
                return [[this.records[key]]];
            }
            return [[]];
        }
        
        // INSERT ON DUPLICATE KEY UPDATE simulation
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
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
        
        return [[]];
    },
    reset: function() {
        this.records = {};
        this.queries = [];
    }
};

async function testSuite() {
    console.log('🧪 Iniciando testes do contextManager.js...');
    
    // Initialize with mock DB
    init(mockDb);
    
    // 1. Test Load Context Default
    mockDb.reset();
    let context = await loadContext('whatsapp', '5587999999999');
    
    assert.strictEqual(context.channel, 'whatsapp');
    assert.strictEqual(context.sender, '5587999999999');
    assert.ok(context.conversation_id);
    assert.strictEqual(context.framework_version, '1.0.0');
    assert.strictEqual(context.schema_version, 1);
    assert.strictEqual(context.conversation_context.state.flow, SKILLS.SAUDACAO);
    assert.strictEqual(context.conversation_context.state.step, STATES.INIT);
    assert.strictEqual(context.conversation_context.state.waiting_for, WAITING_FOR.NONE);
    assert.strictEqual(context.order_context.cart.product_id, null);
    assert.strictEqual(context.customer_context.name, null);
    console.log('✅ 1. Carga de contexto padrão inicializada com sucesso.');

    // 2. Test Save Context
    context.conversation_context.state.flow = SKILLS.CATALOGO;
    context.conversation_context.state.step = STATES.AWAITING_INPUT;
    context.order_context.cart.product_id = 999;
    context.customer_context.name = 'Cliente Teste';
    
    await saveContext('whatsapp', '5587999999999', context);
    assert.strictEqual(mockDb.queries.length, 2); // 1 select + 1 insert
    console.log('✅ 2. Gravação de contexto persistida com sucesso.');

    // 3. Test Load Context Saved
    let reloadedContext = await loadContext('whatsapp', '5587999999999');
    assert.strictEqual(reloadedContext.conversation_context.state.flow, SKILLS.CATALOGO);
    assert.strictEqual(reloadedContext.conversation_context.state.step, STATES.AWAITING_INPUT);
    assert.strictEqual(reloadedContext.order_context.cart.product_id, 999);
    assert.strictEqual(reloadedContext.customer_context.name, 'Cliente Teste');
    console.log('✅ 3. Recarga de contexto gravado verificada com sucesso.');

    // 4. Test Clear Contexts Independently
    await clearConversationContext('whatsapp', '5587999999999');
    let ctxAfterClearConv = await loadContext('whatsapp', '5587999999999');
    // Flow/State should be default
    assert.strictEqual(ctxAfterClearConv.conversation_context.state.flow, SKILLS.SAUDACAO);
    assert.strictEqual(ctxAfterClearConv.conversation_context.state.step, STATES.INIT);
    // Order and Customer should remain intact!
    assert.strictEqual(ctxAfterClearConv.order_context.cart.product_id, 999);
    assert.strictEqual(ctxAfterClearConv.customer_context.name, 'Cliente Teste');
    console.log('✅ 4. Limpeza isolada do Conversation Context validada.');

    await clearOrderContext('whatsapp', '5587999999999');
    let ctxAfterClearOrder = await loadContext('whatsapp', '5587999999999');
    assert.strictEqual(ctxAfterClearOrder.order_context.cart.product_id, null);
    assert.strictEqual(ctxAfterClearOrder.customer_context.name, 'Cliente Teste');
    console.log('✅ 5. Limpeza isolada do Order Context validada.');

    await clearCustomerContext('whatsapp', '5587999999999');
    let ctxAfterClearCust = await loadContext('whatsapp', '5587999999999');
    assert.strictEqual(ctxAfterClearCust.customer_context.name, null);
    console.log('✅ 6. Limpeza isolada do Customer Context validada.');

    console.log('\n🎉 Todos os testes de contextManager.js passaram!');
}

testSuite().catch((err) => {
    console.error('❌ Falha nos testes:', err);
    process.exit(1);
});
