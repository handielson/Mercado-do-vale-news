import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import * as ProductService from '../04-actions/ProductService.js';

/**
 * EscolhaMemoriaSkill
 * Conducts and validates the selection of product memory capacity.
 */
export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase();

    if (!context || !context.order_context || !context.conversation_context) {
        return { success: false, response: '', routing: null, context };
    }

    // 1. Detect product switch
    if (text.length > 3 && !/^\d+$/.test(text)) {
        const searchRes = await ProductService.findProducts({ model: text });
        if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
            const foundProduct = searchRes.data[0];
            if (foundProduct.id !== context.order_context.cart.product_id) {
                // Switch product, clear selections
                context.order_context.cart.product_id = foundProduct.id;
                context.order_context.cart.selected_memory = null;
                context.order_context.cart.selected_color = null;
                context.order_context.cart.selected_case = null;

                context.conversation_context.state.flow = SKILLS.PRODUTO;
                context.conversation_context.state.step = STATES.INIT;
                context.conversation_context.routing.last_intent = 'switch_product_during_memory';

                return {
                    success: true,
                    response: `Certo, vamos mudar de modelo para o ${foundProduct.name}.`,
                    routing: {
                        nextSkill: SKILLS.PRODUTO
                    },
                    context
                };
            }
        }
    }

    const productId = context.order_context.cart.product_id;
    if (!productId) {
        return {
            success: true,
            response: 'Não identifiquei qual aparelho estamos configurando. Vamos voltar ao catálogo?',
            routing: { nextSkill: SKILLS.CATALOGO },
            context
        };
    }

    // 2. Fetch product presentation
    const productRes = await ProductService.getProductPresentation(productId);
    if (!productRes.success || !productRes.data) {
        return {
            success: true,
            response: 'Desculpe, o produto está indisponível. Vamos voltar ao catálogo?',
            routing: { nextSkill: SKILLS.CATALOGO },
            context
        };
    }

    const { variations } = productRes.data;

    // Case 1: Single memory variation exists (auto-select)
    if (variations.length === 1) {
        context.order_context.cart.selected_memory = variations[0].memory;
        context.conversation_context.state.flow = SKILLS.ESCOLHA_COR;
        context.conversation_context.state.step = STATES.INIT;
        return {
            success: true,
            response: '',
            routing: { nextSkill: SKILLS.ESCOLHA_COR },
            context
        };
    }

    // 3. Match user choice against variations list
    let matchedMemory = null;

    // A. Check for index number selection (1, 2, ...)
    const selectedNumber = parseInt(text, 10);
    if (Number.isFinite(selectedNumber) && selectedNumber > 0 && selectedNumber <= variations.length) {
        matchedMemory = variations[selectedNumber - 1].memory;
    } else {
        // B. Check for text capacity match (e.g. 256, 512, 12gb)
        // Extract numbers from input to match variations
        const cleanWords = cleanText.replace(/[^\d]/g, ' ').split(/\s+/).filter(Boolean);
        for (const variation of variations) {
            const vMemoryStr = variation.memory.toLowerCase();
            // Check if any numbers in message match variation memory capacity (e.g. 256 or 512)
            const isMatch = cleanWords.some(word => vMemoryStr.includes(word)) || cleanText.includes(vMemoryStr);
            if (isMatch) {
                matchedMemory = variation.memory;
                break;
            }
        }
    }

    // 4. Handle matching result
    if (matchedMemory) {
        context.order_context.cart.selected_memory = matchedMemory;
        
        context.conversation_context.state.flow = SKILLS.ESCOLHA_COR;
        context.conversation_context.state.step = STATES.INIT;
        context.conversation_context.routing.last_intent = 'select_memory_success';

        return {
            success: true,
            response: `Versão de ${matchedMemory} selecionada com sucesso!`,
            routing: {
                nextSkill: SKILLS.ESCOLHA_COR
            },
            context
        };
    }

    // 5. Invalid memory input: ask again and present options
    const optionsText = variations.map((v, i) => `${i + 1}. ${v.memory}`).join('\n');
    const invalidResponse = `Não encontrei essa opção de memória. Por favor, escolha uma das opções válidas:\n\n${optionsText}\n\nQual versão você prefere?`;

    // Validate response
    const validation = PolicyEngine.validate(invalidResponse, context);
    if (!validation.approved) {
        context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
        return {
            success: false,
            response: '',
            routing: null,
            context
        };
    }

    // Update Context after successful validation
    context.conversation_context.state.flow = SKILLS.ESCOLHA_MEMORIA;
    context.conversation_context.state.step = STATES.AWAITING_INPUT;
    context.conversation_context.conversation.last_bot_question = invalidResponse;
    context.conversation_context.routing.last_intent = 'select_memory_invalid';
    context.conversation_context.routing.validation_status = VALIDATION.PASSED;

    return {
        success: true,
        response: invalidResponse,
        routing: null,
        context
    };
}
