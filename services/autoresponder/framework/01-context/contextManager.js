import crypto from 'crypto';
import { 
    SKILLS, 
    STATES, 
    WAITING_FOR, 
    VALIDATION, 
    FRAMEWORK_VERSION, 
    SCHEMA_VERSION 
} from '../constants.js';

let pool = null;

/**
 * Initializes the database pool reference for the context manager.
 * @param {object} mysqlPool 
 */
export function init(mysqlPool) {
    pool = mysqlPool;
}

/**
 * Returns default values for Conversation Context
 */
export function getDefaultConversationContext() {
    return {
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
            validation_status: VALIDATION.PENDING
        },
        automation: {
            paused: false,
            pausedAt: null,
            pauseReason: null,
            pausedBy: null,
            autoResumeAt: null,
            mode: 'AI'
        }
    };
}

/**
 * Returns default values for Order Context
 */
export function getDefaultOrderContext() {
    return {
        cart: {
            product_id: null,
            model_name: null,
            quantity: null,
            color: null,
            memory: null
        },
        delivery: {
            method: null,
            cep: null,
            address_details: null,
            shipping_fee: null
        },
        payment: {
            method: null,
            installments: null,
            amount: null
        }
    };
}

/**
 * Returns default values for Customer Context
 */
export function getDefaultCustomerContext() {
    return {
        name: null,
        cpf: null,
        phone: null,
        last_delivery_address: null,
        customer_tier: null
    };
}

/**
 * Loads context from DB or creates new one with defaults.
 * @param {string} channel 
 * @param {string} sender 
 * @returns {Promise<object>}
 */
export async function loadContext(channel, sender) {
    if (!pool) {
        throw new Error('[ContextManager] Database pool not initialized. Call init(pool) first.');
    }

    const query = `
        SELECT conversation_id, framework_version, schema_version, conversation_context, order_context, customer_context 
        FROM autoresponder_ai_context 
        WHERE channel = ? AND sender = ?
        LIMIT 1
    `;
    
    const [rows] = await pool.query(query, [channel, sender]);

    if (rows && rows.length > 0) {
        const row = rows[0];
        const conversation_context = typeof row.conversation_context === 'string' ? JSON.parse(row.conversation_context) : row.conversation_context;
        if (conversation_context && !conversation_context.automation) {
            conversation_context.automation = {
                paused: false,
                pausedAt: null,
                pauseReason: null,
                pausedBy: null,
                autoResumeAt: null,
                mode: 'AI'
            };
        }
        return {
            channel,
            sender,
            conversation_id: row.conversation_id,
            framework_version: row.framework_version,
            schema_version: row.schema_version,
            conversation_context,
            order_context: typeof row.order_context === 'string' ? JSON.parse(row.order_context) : row.order_context,
            customer_context: typeof row.customer_context === 'string' ? JSON.parse(row.customer_context) : row.customer_context
        };
    }

    // Default Context if row does not exist
    return {
        channel,
        sender,
        conversation_id: crypto.randomUUID(),
        framework_version: FRAMEWORK_VERSION,
        schema_version: SCHEMA_VERSION,
        conversation_context: getDefaultConversationContext(),
        order_context: getDefaultOrderContext(),
        customer_context: getDefaultCustomerContext()
    };
}

/**
 * Persists context to the database (inserts if new, updates if exists).
 * @param {string} channel 
 * @param {string} sender 
 * @param {object} contextData 
 */
export async function saveContext(channel, sender, contextData) {
    if (!pool) {
        throw new Error('[ContextManager] Database pool not initialized. Call init(pool) first.');
    }

    const { 
        conversation_id = crypto.randomUUID(), 
        conversation_context, 
        order_context, 
        customer_context 
    } = contextData;

    const query = `
        INSERT INTO autoresponder_ai_context 
        (channel, sender, conversation_id, framework_version, schema_version, conversation_context, order_context, customer_context)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        conversation_context = VALUES(conversation_context),
        order_context = VALUES(order_context),
        customer_context = VALUES(customer_context),
        updated_at = CURRENT_TIMESTAMP
    `;

    const values = [
        channel,
        sender,
        conversation_id,
        FRAMEWORK_VERSION,
        SCHEMA_VERSION,
        JSON.stringify(conversation_context || getDefaultConversationContext()),
        JSON.stringify(order_context || getDefaultOrderContext()),
        JSON.stringify(customer_context || getDefaultCustomerContext())
    ];

    await pool.query(query, values);
}

/**
 * Resets only the conversation context (states/flow control)
 * @param {string} channel 
 * @param {string} sender 
 */
export async function clearConversationContext(channel, sender) {
    const context = await loadContext(channel, sender);
    context.conversation_context = getDefaultConversationContext();
    await saveContext(channel, sender, context);
}

/**
 * Resets only the order context (cart/delivery/payment)
 * @param {string} channel 
 * @param {string} sender 
 */
export async function clearOrderContext(channel, sender) {
    const context = await loadContext(channel, sender);
    context.order_context = getDefaultOrderContext();
    await saveContext(channel, sender, context);
}

/**
 * Resets only the customer context
 * @param {string} channel 
 * @param {string} sender 
 */
export async function clearCustomerContext(channel, sender) {
    const context = await loadContext(channel, sender);
    context.customer_context = getDefaultCustomerContext();
    await saveContext(channel, sender, context);
}
