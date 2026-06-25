/**
 * PaymentPolicy
 * Validates payment constraints: prohibits boleto bancário and checks for payment options formatting structure.
 */
class PaymentPolicy {
    constructor() {
        this.name = 'PaymentPolicy';
    }

    validate(response, context) {
        const violations = [];
        const text = String(response || '');

        // 1. Prohibit boleto
        const boletoRegex = /\bboleto(s)?(\s+banc[áa]rio(s)?)?\b/i;
        if (boletoRegex.test(text)) {
            violations.push({
                code: 'BOLETO_PROHIBITED',
                severity: 'CRITICAL',
                message: 'Boleto bancário não é aceito como forma de pagamento.'
            });
        }

        // 2. Format validation of payment answers
        // If the text describes payment methods, ensure it aligns with standard structured formats
        const mentionsPaymentMethods = text.includes('PIX') || text.includes('Dinheiro') || text.includes('Cartão') || text.includes('Misto');
        if (mentionsPaymentMethods) {
            // Check if there are loose financial formulas or calculation annotations
            if (/\b(juros\s*de\s*\d+%\s*\+\s*\d+|calculando\s*juros)\b/i.test(text)) {
                violations.push({
                    code: 'MANUAL_CALCULATION_DETECTED',
                    severity: 'HIGH',
                    message: 'Foi identificada tentativa de explicitar cálculos financeiros manuais de juros.'
                });
            }
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new PaymentPolicy();
