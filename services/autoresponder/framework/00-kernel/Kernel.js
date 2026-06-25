import { AsyncLocalStorage } from 'async_hooks';
import { loadContext, saveContext } from '../01-context/contextManager.js';
import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';

// Import services
import * as SettingsService from '../SettingsService.js';
import { classifyMessage } from '../MessageClassifier.js';
import { simulateTyping } from '../TypingService.js';

// Import skills
import { handle as greetingHandle } from '../05-skills/GreetingSkill.js';
import { handle as catalogHandle } from '../05-skills/CatalogSkill.js';
import { handle as productHandle } from '../05-skills/ProductSkill.js';
import { handle as memoriaHandle } from '../05-skills/EscolhaMemoriaSkill.js';
import { handle as corHandle } from '../05-skills/EscolhaCorSkill.js';
import { handle as entregaHandle } from '../05-skills/EntregaSkill.js';
import { handle as pagamentoHandle } from '../05-skills/PaymentSkill.js';
import { handle as resumoHandle } from '../05-skills/ResumoSkill.js';
import { handle as finalizacaoHandle } from '../05-skills/FinalizacaoSkill.js';

// Import actions to init
import * as ProductService from '../04-actions/ProductService.js';
import * as DeliveryService from '../04-actions/DeliveryService.js';
import * as OrderService from '../04-actions/OrderService.js';
import * as PaymentService from '../04-actions/PaymentService.js';
import * as PromotionService from '../04-actions/PromotionService.js';
import * as CustomerService from '../04-actions/CustomerService.js';
import * as StoreService from '../04-actions/StoreService.js';

export const kernelStorage = new AsyncLocalStorage();

const SKILL_MAP = {
    [SKILLS.SAUDACAO]: greetingHandle,
    [SKILLS.CATALOGO]: catalogHandle,
    [SKILLS.PRODUTO]: productHandle,
    [SKILLS.ESCOLHA_MEMORIA]: memoriaHandle,
    [SKILLS.ESCOLHA_COR]: corHandle,
    [SKILLS.CAPINHA]: corHandle,
    [SKILLS.BRINDES]: corHandle,
    [SKILLS.ENTREGA]: entregaHandle,
    [SKILLS.FRETE]: entregaHandle,
    [SKILLS.PAGAMENTO]: pagamentoHandle,
    [SKILLS.PAGAMENTO_MISTO]: pagamentoHandle,
    [SKILLS.RESUMO]: resumoHandle,
    [SKILLS.FINALIZACAO]: finalizacaoHandle,
};

let globalRealPool = null;

// Simulated Mock Database for Sandbox Mode
export const mockDbInstance = {
    records: {},
    orders: [],
    queries: [],
    query: async function(sql, values = []) {
        const cleanSql = sql.toUpperCase().replace(/\s+/g, ' ').trim();
        this.queries.push({ sql: cleanSql, values });

        if (cleanSql.includes('FROM CONVERSATION_CONTEXT') || cleanSql.includes('FROM AUTORESPONDER_AI_CONTEXT')) {
            const [channel, sender] = values;
            const key = `${channel}:${sender}`;
            const record = this.records[key];
            return record ? [[record]] : [[]];
        }

        if (cleanSql.includes('INSERT INTO CONVERSATION_CONTEXT') || cleanSql.includes('INSERT INTO AUTORESPONDER_AI_CONTEXT')) {
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

        if (cleanSql.includes('FROM CEP_CACHE')) {
            return [[{ street: 'Rua João Pessoa', neighborhood: 'Centro', city: 'Petrolina', state: 'PE' }]];
        }

        if (cleanSql.includes('FROM SHIPPING_RULES')) {
            return [[{ fee: 20.00, estimated_days: 3 }]];
        }

        if (cleanSql.includes('FROM PRODUCTS') && cleanSql.includes('WHERE ID = ? OR SKU = ?')) {
            return [[{
                id: 101,
                name: 'Redmi Note 15',
                sku: 'redmi-15',
                price: 1499.00,
                stock_quantity: 5
            }]];
        }

        if (cleanSql.includes('FROM PRODUCTS') || cleanSql.includes('FROM CATALOG')) {
            return [[
                { id: 101, name: 'Redmi Note 15', sku: 'redmi-15', price: 1499.00, stock_quantity: 5 },
                { id: 102, name: 'iPhone 15 Pro', sku: 'iphone-15', price: 7499.00, stock_quantity: 2 }
            ]];
        }

        if (cleanSql.includes('FROM ORDERS WHERE STATUS = ?')) {
            const statusKey = values[0];
            const found = this.orders.find(o => o.status === statusKey);
            return found ? [[found]] : [[]];
        }

        if (cleanSql.startsWith('INSERT INTO ORDERS')) {
            const newOrder = {
                id: 601 + this.orders.length,
                total_amount: values[0] || 0,
                status: values[1] || 'confirmed',
                shipping_fee: values[2] || 0,
                payment_method: values[3] || 'pix'
            };
            this.orders.push(newOrder);
            return [{ insertId: newOrder.id }];
        }

        if (cleanSql.startsWith('INSERT INTO ORDER_ITEMS')) {
            return [{ affectedRows: 1 }];
        }

        // Mock for system_settings queries
        if (cleanSql.includes('FROM SYSTEM_SETTINGS')) {
            const mockSettings = Object.entries(this.records.system_settings || {}).map(([key, value]) => ({
                setting_key: key,
                setting_value: value
            }));
            return [mockSettings];
        }
        if (cleanSql.startsWith('INSERT INTO SYSTEM_SETTINGS') || cleanSql.startsWith('UPDATE SYSTEM_SETTINGS')) {
            if (!this.records.system_settings) this.records.system_settings = {};
            // Simplified mock query parsing
            const key = values[values.length - 1];
            const val = values[0];
            this.records.system_settings[key] = val;
            return [{ affectedRows: 1 }];
        }

        return [[]];
    },
    reset: function() {
        this.records = {};
        this.orders = [];
        this.queries = [];
    }
};

// Stack trace caller parser to identify Service.method
function getCallerAction() {
    const stack = new Error().stack || '';
    const lines = stack.split('\n');
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('04-actions') || line.includes('Service.')) {
            const match = line.match(/at\s+(?:async\s+)?(?:Object\.)?([^\s\(\[\]]+)(?:\s+\[as\s+([^\s]+)\])?\s+\((?:file:\/\/\/)?(.*\/([^\/]+Service)\.js):/i);
            if (match) {
                let method = match[2] || match[1];
                method = method.replace(/^Module\./, '');
                const service = match[4];
                return `${service}.${method}`;
            }
        }
    }
    return 'Database.query';
}

class ProxyPool {
    async query(sql, values = []) {
        const store = kernelStorage.getStore();
        const mockMode = store?.mockMode || false;
        
        const poolToUse = mockMode ? mockDbInstance : globalRealPool;

        if (!poolToUse) {
            throw new Error('DATABASE_POOL_NOT_INITIALIZED');
        }

        const startedAt = Date.now();
        let error = null;
        let result = null;
        try {
            result = await poolToUse.query(sql, values);
            return result;
        } catch (err) {
            error = err.message;
            throw err;
        } finally {
            const duration = Date.now() - startedAt;
            if (store) {
                const actionName = getCallerAction();
                
                // Track actions in trace
                store.trace.actions.push({
                    name: actionName,
                    query: sql,
                    params: values,
                    duration,
                    timestamp: new Date().toISOString(),
                    success: !error,
                    error
                });
                
                store.logs.push({
                    timestamp: new Date().toISOString(),
                    level: error ? 'ERROR' : 'INFO',
                    source: 'ACTION',
                    event: actionName,
                    duration,
                    details: { query: sql, params: values, success: !error }
                });
            }
        }
    }
}

// Global Proxy Pool
const proxyPool = new ProxyPool();

export function init(mysqlPool) {
    globalRealPool = mysqlPool;
    
    // Wire up all services with the Proxy Pool
    ProductService.init(proxyPool);
    DeliveryService.init(proxyPool);
    OrderService.init(proxyPool);
    PaymentService.init(proxyPool);
    PromotionService.init(proxyPool);
    CustomerService.init(proxyPool);
    StoreService.init(proxyPool);

    SettingsService.init(mysqlPool || mockDbInstance);
    // Trigger initial settings loading
    SettingsService.loadSettings().catch(() => {});
}

// Auto-initialize contextManager with the same proxyPool
import * as contextManager from '../01-context/contextManager.js';
contextManager.init(proxyPool);

/**
 * Handle incoming messages through the kernel.
 * Executed in strict order of validations:
 * 1. Bot habilitado globalmente
 * 2. Conversa pausada
 * 3. Handoff
 * 4. MessageClassifier
 * 5. Context Manager
 * 6. Skills
 * 7. Policies
 * 8. TypingService
 * 9. Envio da resposta
 */
export async function handle(message, channel, sender, options = {}) {
    const startedAtTotal = Date.now();

    const trace = {
        sessionId: 'SES-' + Date.now() + '-' + Math.floor(Math.random() * 1000000),
        conversationId: null,
        createdAt: new Date().toISOString(),
        kernel: {
            message,
            channel,
            sender
        },
        skills: [],
        actions: [],
        policies: [],
        timings: {},
        warnings: [],
        errors: []
    };

    const metrics = {
        totalTime: 0,
        kernelTime: 0,
        skillsTime: 0,
        actionsTime: 0,
        policiesTime: 0
    };

    const store = {
        mockMode: options.mockMode || false,
        trace,
        logs: []
    };

    return kernelStorage.run(store, async () => {
        store.logs.push({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            source: 'KERNEL',
            event: 'MESSAGE_RECEIVED',
            duration: 0,
            details: { message, channel, sender }
        });

        // Step 1: Bot habilitado globalmente
        const botEnabled = SettingsService.get('automation.enabled', true);
        if (!botEnabled) {
            store.logs.push({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                source: 'KERNEL',
                event: 'OPERATIONAL_EVENT',
                type: 'BOT_DISABLED',
                duration: 0,
                details: { reason: 'Bot desativado globalmente' }
            });
            return {
                response: '',
                context: null,
                routing: null,
                metrics: { totalTime: Date.now() - startedAtTotal, kernelTime: Date.now() - startedAtTotal, skillsTime: 0, actionsTime: 0, policiesTime: 0 },
                trace,
                logs: store.logs
            };
        }

        // Step 4 (Pre-load/Classify): MessageClassifier
        const rawPayload = options.rawPayload || { message, channel, sender };
        const classified = classifyMessage(rawPayload);

        // Step 5: Context Manager (Load Context)
        let context;
        try {
            context = await loadContext(channel, sender);
            context.mockMode = store.mockMode;
        } catch (err) {
            console.error('[Kernel] Failed to load context:', err);
            return {
                response: 'Erro ao carregar contexto.',
                context: null,
                routing: null,
                metrics: { totalTime: Date.now() - startedAtTotal, kernelTime: Date.now() - startedAtTotal, skillsTime: 0, actionsTime: 0, policiesTime: 0 },
                trace,
                logs: store.logs
            };
        }

        // Initialize state arrays and settings
        if (!context.conversation_context) context.conversation_context = {};
        if (!context.conversation_context.automation) {
            context.conversation_context.automation = {
                paused: false,
                pausedAt: null,
                pauseReason: null,
                pausedBy: null,
                autoResumeAt: null,
                mode: 'AI'
            };
        }

        const auto = context.conversation_context.automation;

        // Step 2: Conversa pausada (Auto-resume check)
        if (auto.paused && auto.autoResumeAt) {
            const resumeTime = new Date(auto.autoResumeAt).getTime();
            if (Date.now() > resumeTime) {
                // Auto-resume timer expired, resume IA
                auto.paused = false;
                auto.pausedAt = null;
                auto.pauseReason = null;
                auto.pausedBy = null;
                auto.autoResumeAt = null;
                auto.mode = 'AI';
                
                store.logs.push({
                    timestamp: new Date().toISOString(),
                    level: 'INFO',
                    source: 'KERNEL',
                    event: 'OPERATIONAL_EVENT',
                    type: 'AI_RESUMED',
                    duration: 0,
                    details: { reason: 'Pausa expirada automaticamente' }
                });
            }
        }

        // Step 3: Handoff Detection & Execution
        if (classified.source === 'operator') {
            const handoffEnabled = SettingsService.get('automation.handoff_enabled', true);
            if (handoffEnabled) {
                const pauseTimeoutMinutes = SettingsService.get('automation.pause_timeout', 1440);
                auto.paused = true;
                auto.pausedAt = new Date().toISOString();
                auto.pauseReason = 'operator_handoff';
                auto.pausedBy = classified.operatorName || classified.operatorId || 'operator';
                auto.mode = 'HUMAN';
                auto.autoResumeAt = new Date(Date.now() + (pauseTimeoutMinutes * 60000)).toISOString();

                await saveContext(channel, sender, context);

                store.logs.push({
                    timestamp: new Date().toISOString(),
                    level: 'INFO',
                    source: 'KERNEL',
                    event: 'OPERATIONAL_EVENT',
                    type: 'HANDOFF_STARTED',
                    duration: 0,
                    details: { operator: auto.pausedBy, timeout: pauseTimeoutMinutes }
                });

                return {
                    response: '',
                    context,
                    routing: null,
                    metrics: { totalTime: Date.now() - startedAtTotal, kernelTime: Date.now() - startedAtTotal, skillsTime: 0, actionsTime: 0, policiesTime: 0 },
                    trace,
                    logs: store.logs
                };
            }
        }

        // Step 2: Conversa pausada (Strict validation)
        if (auto.paused || auto.mode === 'HUMAN') {
            store.logs.push({
                timestamp: new Date().toISOString(),
                level: 'INFO',
                source: 'KERNEL',
                event: 'MESSAGE_IGNORED',
                duration: 0,
                details: { reason: 'Conversa pausada/atendimento humano', mode: auto.mode }
            });
            return {
                response: '',
                context,
                routing: null,
                metrics: { totalTime: Date.now() - startedAtTotal, kernelTime: Date.now() - startedAtTotal, skillsTime: 0, actionsTime: 0, policiesTime: 0 },
                trace,
                logs: store.logs
            };
        }

        // Normal Flow Continuation
        if (!context.conversation_context.conversation) {
            context.conversation_context.conversation = {
                last_message_at: null,
                last_bot_question: null,
                message_count: 0
            };
        }
        context.conversation_context.conversation.message_count = (context.conversation_context.conversation.message_count || 0) + 1;
        context.conversation_context.conversation.last_message_at = new Date().toISOString();

        if (!context.conversation_context.session_id) {
            context.conversation_context.session_id = trace.sessionId;
        }
        trace.sessionId = context.conversation_context.session_id;
        trace.conversationId = context.conversation_id;

        const previousLastBotQuestion = context.conversation_context?.conversation?.last_bot_question;

        try {
            // Step 6: Skills execution
            const currentFlow = context.conversation_context.state?.flow || SKILLS.SAUDACAO;
            const activeSkills = options.activeSkills || {};

            let skillResult;
            let handler = SKILL_MAP[currentFlow];

            if (activeSkills[currentFlow] === false) {
                const warnMsg = `Skill '${currentFlow}' desativada via Feature Flags. Redirecionando para saudacao.`;
                trace.warnings.push(warnMsg);
                context.conversation_context.state.flow = SKILLS.SAUDACAO;
                context.conversation_context.state.step = STATES.INIT;
                handler = greetingHandle;
            }

            if (!handler) {
                handler = greetingHandle;
            }

            const startSkill = Date.now();
            skillResult = await handler(classified.messageText, context);
            const skillDuration = Date.now() - startSkill;

            trace.skills.push({
                name: currentFlow,
                duration: skillDuration,
                timestamp: new Date().toISOString()
            });

            // Step 7: Policies Validation
            const startPolicies = Date.now();
            const currentLastBotQuestion = skillResult.context?.conversation_context?.conversation?.last_bot_question;
            if (skillResult.context?.conversation_context?.conversation) {
                skillResult.context.conversation_context.conversation.last_bot_question = previousLastBotQuestion;
            }

            const validation = PolicyEngine.validate(skillResult.response, skillResult.context);

            if (skillResult.context?.conversation_context?.conversation) {
                skillResult.context.conversation_context.conversation.last_bot_question = currentLastBotQuestion;
            }

            const policiesDuration = Date.now() - startPolicies;

            trace.policies = (validation.violations || []).map(v => ({
                name: v.policy,
                approved: validation.approved,
                violation: validation.approved ? null : v.code,
                message: validation.approved ? 'Passed' : v.message
            }));

            if (validation.approved) {
                // Save context
                await saveContext(channel, sender, skillResult.context);
            } else {
                const failMsg = `Violação de política: ${validation.violations[0].message}`;
                trace.errors.push(failMsg);
                if (skillResult.context.conversation_context.routing) {
                    skillResult.context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                }
            }

            const responseText = validation.approved ? skillResult.response : '';

            // Step 8: TypingService
            let typingDuration = 0;
            if (responseText) {
                store.logs.push({
                    timestamp: new Date().toISOString(),
                    level: 'INFO',
                    source: 'KERNEL',
                    event: 'OPERATIONAL_EVENT',
                    type: 'TYPING_STARTED',
                    duration: 0,
                    details: { sender }
                });

                typingDuration = await simulateTyping(sender, responseText, { mockMode: store.mockMode });

                store.logs.push({
                    timestamp: new Date().toISOString(),
                    level: 'INFO',
                    source: 'KERNEL',
                    event: 'OPERATIONAL_EVENT',
                    type: 'TYPING_FINISHED',
                    duration: typingDuration,
                    details: { sender }
                });
            }

            // Step 9: Envio da resposta (Calculate timing metrics and return)
            const totalTime = Date.now() - startedAtTotal;
            const kernelTime = totalTime - skillDuration - policiesDuration - typingDuration;

            metrics.totalTime = totalTime;
            metrics.kernelTime = kernelTime;
            metrics.skillsTime = skillDuration;
            metrics.actionsTime = trace.actions.reduce((acc, curr) => acc + curr.duration, 0);
            metrics.policiesTime = policiesDuration;

            trace.timings = {
                total: totalTime,
                kernel: kernelTime,
                skills: skillDuration,
                actions: metrics.actionsTime,
                policies: policiesDuration,
                typing: typingDuration
            };

            return {
                response: responseText,
                context: skillResult.context,
                routing: skillResult.routing,
                metrics,
                trace,
                logs: store.logs
            };

        } catch (err) {
            const errDuration = Date.now() - startedAtTotal;
            trace.errors.push(`Erro fatal no Kernel: ${err.message}`);
            return {
                response: 'Desculpe, ocorreu um erro interno. Vamos tentar novamente.',
                context: null,
                routing: null,
                metrics: { totalTime: errDuration, kernelTime: errDuration, skillsTime: 0, actionsTime: 0, policiesTime: 0 },
                trace,
                logs: store.logs
            };
        }
    });
}
