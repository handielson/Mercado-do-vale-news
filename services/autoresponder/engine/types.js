/**
 * @typedef {Object} ConversationState
 * @property {'none'|'greeting'|'product_search'|'purchase'|'delivery'|'payment'|'customer_data'|'handoff'} flow
 * @property {string} step
 * @property {Object} data
 * @property {string|null} last_intent
 * @property {string|null} expires_at
 */

/**
 * @typedef {Object} BotReply
 * @property {string} message
 * @property {string} intent
 * @property {ConversationState} nextState
 * @property {number} matchedCount
 * @property {Array<Object>} matchedProducts
 */

/**
 * @typedef {Object} FlowHandler
 * @property {string} name
 * @property {(args: { message: string, state: ConversationState, settings: Object }) => boolean} canHandle
 * @property {(args: { sender: string, message: string, state: ConversationState, settings: Object, context: Object }) => Promise<BotReply|null>} handle
 */

export {};
