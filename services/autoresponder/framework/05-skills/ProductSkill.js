import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import * as ProductService from '../04-actions/ProductService.js';

/**
 * Format a single variation to the strict required layout.
 */
function formatProductLayout(modelName, variation) {
    const installmentsAmount = (variation.priceCard / 12).toFixed(2);
    const colorsList = variation.colors.length > 0 ? variation.colors.join(', ') : 'N/A';
    
    return `${modelName}
📱 ${variation.memory}
💰 R$ ${variation.pricePix.toFixed(2)} à vista no PIX
💳 Cartão: 12x de R$ ${installmentsAmount} (total R$ ${variation.priceCard.toFixed(2)})
🎨 Cores disponíveis: ${colorsList}
🔗 Link do produto: ${variation.link}`;
}

/**
 * Append standard gift text.
 */
function appendGifts() {
    return `🎁 Na compra deste smartphone você ganha:
✅ Película 3D.
✅ Uma capinha de silicone extra.`;
}

/**
 * ProductSkill
 * Displays product variations and manages memory selection routing.
 */
export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase();

    if (!context || !context.order_context || !context.conversation_context) {
        return { success: false, response: '', routing: null, context };
    }

    // 1. Detect model switch during active flow
    let activeProductId = context.order_context.cart.product_id;
    if (text.length > 3 && !/^\d+$/.test(text)) {
        // Try searching if they named another product model
        const searchRes = await ProductService.findProducts({ model: text });
        if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
            const foundProduct = searchRes.data[0];
            if (foundProduct.id !== activeProductId) {
                // Switch product, clear previous details
                context.order_context.cart.product_id = foundProduct.id;
                context.order_context.cart.selected_memory = null;
                context.order_context.cart.selected_color = null;
                context.order_context.cart.selected_case = null;
                activeProductId = foundProduct.id;
            }
        }
    }

    if (!activeProductId) {
        const errorResponse = 'Por favor, selecione um produto do catálogo primeiro.';
        return {
            success: true,
            response: errorResponse,
            routing: { nextSkill: SKILLS.CATALOGO },
            context
        };
    }

    // 2. Fetch product details and variations from Service
    const productRes = await ProductService.getProductPresentation(activeProductId);
    if (!productRes.success || !productRes.data) {
        const errorResponse = 'Desculpe, o produto selecionado está indisponível no momento. Gostaria de voltar ao catálogo?';
        return {
            success: true,
            response: errorResponse,
            routing: null,
            context
        };
    }

    const { model: modelName, variations } = productRes.data;

    if (!variations || variations.length === 0) {
        const errorResponse = 'Desculpe, este modelo está sem estoque no momento. Deseja voltar ao catálogo?';
        return {
            success: true,
            response: errorResponse,
            routing: null,
            context
        };
    }

    // Save model name in context
    context.order_context.cart.model = modelName;

    // 3. Check memory specification in the message (Case 3)
    let preSelectedMemory = null;
    const memoryMatch = cleanText.match(/\b(\d+)\s*gb\b/i);
    if (memoryMatch) {
        const capacity = memoryMatch[1];
        // Find matching variation
        const matched = variations.find(v => v.memory.includes(capacity));
        if (matched) {
            preSelectedMemory = matched.memory;
        }
    }

    // 4. Formatting output response based on single or multiple memory variations
    let responseText = '';
    let nextSkill = SKILLS.ESCOLHA_MEMORIA;

    // Case 1: Single memory variation
    if (variations.length === 1) {
        const singleVar = variations[0];
        context.order_context.cart.selected_memory = singleVar.memory;
        nextSkill = SKILLS.ESCOLHA_COR;

        responseText = `${formatProductLayout(modelName, singleVar)}\n\n${appendGifts()}`;
    } else {
        // Multiple variations
        const formattedVars = variations.map(v => formatProductLayout(modelName, v)).join('\n\n');
        
        // Case 3: Memory pre-specified by client
        if (preSelectedMemory) {
            context.order_context.cart.selected_memory = preSelectedMemory;
            nextSkill = SKILLS.ESCOLHA_COR;
            responseText = `${formattedVars}\n\n${appendGifts()}`;
        } else {
            // Case 2: Memory choice needed
            nextSkill = SKILLS.ESCOLHA_MEMORIA;
            responseText = `${formattedVars}\n\n${appendGifts()}\n\nQual versão de memória você prefere?`;
        }
    }

    // Validate with PolicyEngine
    const validation = PolicyEngine.validate(responseText, context);
    if (!validation.approved) {
        context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
        return {
            success: false,
            response: '',
            routing: null,
            context
        };
    }

    // Update conversation context after validation passes
    context.conversation_context.state.flow = nextSkill;
    context.conversation_context.state.step = STATES.INIT;
    context.conversation_context.conversation.last_bot_question = responseText;
    context.conversation_context.routing.last_intent = preSelectedMemory ? 'product_details_with_memory' : 'product_details';
    context.conversation_context.routing.validation_status = VALIDATION.PASSED;

    return {
        success: true,
        response: responseText,
        routing: {
            nextSkill
        },
        context
    };
}
