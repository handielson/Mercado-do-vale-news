/**
 * GeneralPolicy
 * Validates basic presence and structural integrity of the context.
 */
class GeneralPolicy {
    constructor() {
        this.name = 'GeneralPolicy';
    }

    validate(response, context) {
        const violations = [];

        if (!context) {
            violations.push({
                code: 'MISSING_CONTEXT',
                severity: 'CRITICAL',
                message: 'Contexto é obrigatório e não foi fornecido.'
            });
            return { approved: false, violations };
        }

        if (!context.conversation_context) {
            violations.push({
                code: 'INVALID_CONVERSATION_CONTEXT',
                severity: 'HIGH',
                message: 'conversation_context está ausente no contexto.'
            });
        }

        if (!context.order_context) {
            violations.push({
                code: 'INVALID_ORDER_CONTEXT',
                severity: 'HIGH',
                message: 'order_context está ausente no contexto.'
            });
        }

        if (!context.customer_context) {
            violations.push({
                code: 'INVALID_CUSTOMER_CONTEXT',
                severity: 'HIGH',
                message: 'customer_context está ausente no contexto.'
            });
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new GeneralPolicy();
