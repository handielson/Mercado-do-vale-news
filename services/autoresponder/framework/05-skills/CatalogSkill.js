import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import * as ProductService from '../04-actions/ProductService.js';

// Supported brands for filter extraction
const KNOWN_BRANDS = ['xiaomi', 'realme', 'samsung', 'apple', 'iphone', 'motorola'];

/**
 * Extract filters from user message text.
 */
function extractFilters(text) {
    const cleanText = text.toLowerCase();
    const filters = {};

    // 1. Brand extraction
    for (const brand of KNOWN_BRANDS) {
        if (cleanText.includes(brand)) {
            // Treat 'iphone' as 'apple' brand internally if needed, or keep it
            filters.brand = brand === 'iphone' ? 'apple' : brand;
            break;
        }
    }

    // 2. Memory extraction (e.g. 128gb, 256 gb)
    const memoryMatch = cleanText.match(/\b(\d+)\s*gb\b/i);
    if (memoryMatch) {
        filters.memory = `${memoryMatch[1]}GB`;
    }

    // 3. Price limit extraction (e.g. "ate R$ 2000", "ate 1500")
    const priceMatch = cleanText.match(/\bat[eé]\s*(?:r\$)?\s*(\d+(?:\.\d{3})*(?:,\d{2})?|\d+)\b/i);
    if (priceMatch) {
        const rawPrice = priceMatch[1].replace(/\./g, '').replace(',', '.');
        filters.max_price = parseFloat(rawPrice);
    }

    return filters;
}

/**
 * CatalogSkill
 * Lists product catalog options grouped by brand and processes choice by list index or model name.
 */
export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase();
    
    // Check if context structures exist
    if (!context || !context.conversation_context || !context.order_context) {
        return {
            success: false,
            response: '',
            routing: null,
            context
        };
    }

    const activeList = context.conversation_context.routing.last_active_list || [];

    // 1. Process choice by continuous list number
    const selectedNumber = parseInt(text, 10);
    if (Number.isFinite(selectedNumber) && selectedNumber > 0 && selectedNumber <= activeList.length) {
        const chosenProductId = activeList[selectedNumber - 1];
        
        context.order_context.cart.product_id = chosenProductId;
        context.conversation_context.state.flow = SKILLS.PRODUTO;
        context.conversation_context.state.step = STATES.INIT;
        context.conversation_context.routing.last_intent = 'select_product_by_number';

        return {
            success: true,
            response: 'Ótima escolha! Vou te mostrar os detalhes deste modelo.',
            routing: {
                nextSkill: SKILLS.PRODUTO
            },
            context
        };
    }

    // 2. Process choice by model name directly
    if (text.length > 2) {
        // Try searching for a product matching this exact model name/query
        const searchRes = await ProductService.findProducts({ model: text });
        if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
            const chosenProduct = searchRes.data[0];
            
            context.order_context.cart.product_id = chosenProduct.id;
            context.conversation_context.state.flow = SKILLS.PRODUTO;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.routing.last_intent = 'select_product_by_name';

            return {
                success: true,
                response: `Localizei o ${chosenProduct.name}! Vou te mostrar os detalhes dele.`,
                routing: {
                    nextSkill: SKILLS.PRODUTO
                },
                context
            };
        }
    }

    // 3. Fallback: Generate or filter catalog list
    const filters = extractFilters(text);
    const hasFilters = Object.keys(filters).length > 0;
    
    let productsRes;
    if (hasFilters) {
        productsRes = await ProductService.findProducts(filters);
    } else {
        productsRes = await ProductService.getCatalog();
    }

    if (!productsRes.success) {
        return {
            success: false,
            response: '',
            routing: null,
            context
        };
    }

    const products = productsRes.data || [];
    if (products.length === 0) {
        const emptyResponse = 'Desculpe, não encontrei nenhum modelo correspondente aos filtros solicitados no momento. Quer ver a lista de modelos completa?';
        
        context.conversation_context.state.flow = SKILLS.CATALOGO;
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.routing.last_intent = 'empty_catalog';
        context.conversation_context.conversation.last_bot_question = emptyResponse;

        return {
            success: true,
            response: emptyResponse,
            routing: null,
            context
        };
    }

    // 4. Group by brand and sort alphabetically
    const brandGroups = {};
    for (const prod of products) {
        const brand = String(prod.brand || 'Outros').trim();
        const normalizedBrand = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
        if (!brandGroups[normalizedBrand]) {
            brandGroups[normalizedBrand] = [];
        }
        brandGroups[normalizedBrand].push(prod);
    }

    // Sort brands alphabetically
    const sortedBrands = Object.keys(brandGroups).sort();
    
    let listText = '';
    const newActiveList = [];
    let counter = 1;

    for (const brand of sortedBrands) {
        listText += `*${brand}*\n`;
        // Sort products of this brand alphabetically by name
        const sortedProducts = brandGroups[brand].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        
        for (const prod of sortedProducts) {
            listText += `${counter}. ${prod.name}\n`;
            newActiveList.push(prod.id);
            counter++;
        }
        listText += '\n';
    }

    // 5. Append prompt question (only one question per message)
    let finalQuestion = 'Qual modelo você gostaria de conhecer melhor?';
    if (hasFilters) {
        finalQuestion = 'Deseja ver a lista completa de aparelhos disponíveis?';
    }

    const fullResponse = `${listText.trim()}\n\n${finalQuestion}`;

    // Validate with PolicyEngine
    const validation = PolicyEngine.validate(fullResponse, context);
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
    context.conversation_context.state.flow = SKILLS.CATALOGO;
    context.conversation_context.state.step = STATES.AWAITING_INPUT;
    context.conversation_context.routing.last_active_list = newActiveList;
    context.conversation_context.conversation.last_bot_question = fullResponse;
    context.conversation_context.routing.last_intent = hasFilters ? 'filtered_catalog' : 'full_catalog';
    context.conversation_context.routing.validation_status = VALIDATION.PASSED;

    return {
        success: true,
        response: fullResponse,
        routing: null,
        context
    };
}
