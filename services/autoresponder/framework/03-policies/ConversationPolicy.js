/**
 * ConversationPolicy
 * Validates conversational constraints: Portuguese language, single question, tone, and no exact repetition.
 */
class ConversationPolicy {
    constructor() {
        this.name = 'ConversationPolicy';
    }

    validate(response, context) {
        const violations = [];
        const text = String(response || '').trim();

        if (!text) {
            violations.push({
                code: 'EMPTY_RESPONSE',
                severity: 'HIGH',
                message: 'A resposta do bot não pode estar vazia.'
            });
            return { approved: false, violations };
        }

        // 1. Single question validation (? count <= 1)
        const questionMarkCount = (text.match(/\?/g) || []).length;
        if (questionMarkCount > 1) {
            violations.push({
                code: 'MULTIPLE_QUESTIONS',
                severity: 'MEDIUM',
                message: `A mensagem contém ${questionMarkCount} perguntas. É permitido apenas uma pergunta por mensagem.`
            });
        }

        // 2. Exact repetition check
        const lastQuestion = context?.conversation_context?.conversation?.last_bot_question;
        if (lastQuestion && text === String(lastQuestion).trim()) {
            violations.push({
                code: 'REPEATED_QUESTION',
                severity: 'MEDIUM',
                message: 'O bot está repetindo exatamente a mesma pergunta enviada anteriormente.'
            });
        }

        // 3. Simple Brazilian Portuguese validation (e.g. check for common foreign language structural indicators if needed)
        // Since we want deterministic structure, check that we don't have purely english/spanish template fragments.
        const lowerText = text.toLowerCase();
        if (lowerText.includes('how can i help') || lowerText.includes('what would you like') || lowerText.includes('buenos dias')) {
            violations.push({
                code: 'NON_PORTUGUESE_CONTENT',
                severity: 'HIGH',
                message: 'A resposta contém expressões em outro idioma. O idioma obrigatório é Português do Brasil.'
            });
        }

        return {
            approved: violations.length === 0,
            violations
        };
    }
}

export default new ConversationPolicy();
