/**
 * WhatsAppPolicy
 * Validates formatting rules specific to WhatsApp client rendering: length limits, character validation.
 */
class WhatsAppPolicy {
    constructor() {
        this.name = 'WhatsAppPolicy';
    }

    validate(response, context) {
        const violations = [];
        const text = String(response || '');

        // 1. Message size limit (WhatsApp single message safety limit)
        const MAX_WHATSAPP_MESSAGE_LENGTH = 4000;
        if (text.length > MAX_WHATSAPP_MESSAGE_LENGTH) {
            violations.push({
                code: 'MESSAGE_TOO_LONG',
                severity: 'HIGH',
                message: `Mensagem excede o limite máximo de ${MAX_WHATSAPP_MESSAGE_LENGTH} caracteres (atual: ${text.length}).`
            });
        }

        // 2. Control characters check
        // Detect characters that are known to cause issues, like null bytes, form feeds, or vertical tabs
        const invalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
        if (invalidChars.test(text)) {
            violations.push({
                code: 'INVALID_CONTROL_CHARACTERS',
                severity: 'HIGH',
                message: 'A resposta contém caracteres de controle inválidos que podem quebrar a renderização.'
            });
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new WhatsAppPolicy();
