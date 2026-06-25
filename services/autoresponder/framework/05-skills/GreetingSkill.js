import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';

// Keywords lists
const GREETINGS = new Set(['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem', 'e ai', 'e aí', 'opa', 'salve']);
const CONTINUATION_WORDS = new Set(['sim', 'nao', 'não', 'ok', 'certo', 'beleza', 'obrigado', 'vlw', 'valeu']);

// Intent detection keywords helper
function detectIntent(text) {
    const cleanText = text.toLowerCase();
    
    if (/\b(redmi|xiaomi|celular|comprar|produto|aparelho|fone|carregador)\b/.test(cleanText)) {
        return SKILLS.PRODUTO;
    }
    if (/\b(hor[aá]rio|funcionamento|aberto|fechado|abertos)\b/.test(cleanText)) {
        return SKILLS.HORARIO;
    }
    if (/\b(endere[cç]o|onde fica|localiza[cç][aã]o|loja)\b/.test(cleanText)) {
        return SKILLS.ENDERECO_LOJA;
    }
    if (/\b(capinha|pel[ií]cula|pelicula)\b/.test(cleanText)) {
        return SKILLS.CAPINHA;
    }
    return null;
}

/**
 * GreetingSkill
 * Handles the conversation entry/welcome logic.
 */
export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase().replace(/[^\w\s]/gi, ''); // remove question marks, etc.
    const words = cleanText.split(/\s+/);
    
    const flow = context?.conversation_context?.state?.flow;
    const step = context?.conversation_context?.state?.step;
    const inProgress = flow && flow !== SKILLS.SAUDACAO;

    // 1. Continuation check
    const isContinuation = words.length === 1 && CONTINUATION_WORDS.has(words[0]);
    if (isContinuation && inProgress) {
        return {
            success: true,
            response: '',
            routing: null,
            context
        };
    }

    // 2. Isolated Name check (during active flow)
    const isSingleWord = words.length === 1;
    const isGreetingWord = GREETINGS.has(words[0]);
    if (isSingleWord && !isGreetingWord && inProgress) {
        return {
            success: true,
            response: '',
            routing: null,
            context
        };
    }

    // 3. Detect greeting and Combined Intent
    const hasGreeting = words.some(word => GREETINGS.has(word)) || cleanText.includes('tudo bem');
    const combinedSkill = detectIntent(text);

    if (hasGreeting || combinedSkill) {
        if (combinedSkill) {
            // Update context state and routing intent, then return routing instruction
            context.conversation_context.state.flow = combinedSkill;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.routing.last_intent = `greeting_combined_${combinedSkill}`;
            
            return {
                success: true,
                response: 'Olá! Seja bem-vindo ao Mercado do Vale.',
                routing: {
                    nextSkill: combinedSkill
                },
                context
            };
        }

        // Simple greeting: generate friendly response
        const greetingResponse = 'Olá! Seja bem-vindo ao Mercado do Vale. Como posso te ajudar hoje?';

        // Policy engine validation
        const validation = PolicyEngine.validate(greetingResponse, context);
        if (!validation.approved) {
            context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
            return {
                success: false,
                response: '',
                routing: null,
                context
            };
        }

        // Update context after successful validation
        context.conversation_context.state.flow = SKILLS.SAUDACAO;
        context.conversation_context.state.step = STATES.COMPLETED;
        context.conversation_context.conversation.last_bot_question = greetingResponse;
        context.conversation_context.routing.last_intent = 'greeting';
        context.conversation_context.routing.validation_status = VALIDATION.PASSED;

        return {
            success: true,
            response: greetingResponse,
            routing: null,
            context
        };
    }

    // Default fallback if it doesn't match greeting criteria
    return {
        success: true,
        response: '',
        routing: null,
        context
    };
}
