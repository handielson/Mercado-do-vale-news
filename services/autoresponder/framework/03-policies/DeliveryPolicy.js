/**
 * DeliveryPolicy
 * Validates delivery/freight structural representation.
 */
class DeliveryPolicy {
    constructor() {
        this.name = 'DeliveryPolicy';
    }

    validate(response, context) {
        const violations = [];
        const text = String(response || '');

        // Validates structural formatting for delivery messages
        // E.g., if freight info is presented, check if it displays standard structures instead of loose calculations
        const hasFreightInfo = text.toLowerCase().includes('frete') || text.toLowerCase().includes('taxa de entrega');
        
        if (hasFreightInfo) {
            // Ensure any money value uses standard format (R$ XX,XX) instead of unstructured raw numbers (e.g. 15 reais, R$15)
            const looseFreightCostRegex = /\b\d+\s*(reais|conto)\b/i;
            if (looseFreightCostRegex.test(text)) {
                violations.push({
                    code: 'INVALID_DELIVERY_FORMAT',
                    severity: 'MEDIUM',
                    message: 'Formato inválido de representação de valor de frete. Utilize o formato R$ XX,XX.'
                });
            }
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new DeliveryPolicy();
