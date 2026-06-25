import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import * as ProductService from '../04-actions/ProductService.js';
import * as PromotionService from '../04-actions/PromotionService.js';

// Postponement keywords/phrases
const POSTPONE_KEYWORDS = [
    'depois escolho',
    'pode deixar sem escolher',
    'escolho na loja',
    'ainda não sei',
    'qualquer uma',
    'vou ver depois',
    'escolher depois',
    'ver depois'
];

// Refusal keywords/phrases
const REFUSE_KEYWORDS = [
    'não quero',
    'nao quero',
    'pode deixar sem',
    'sem capinha',
    'não precisa',
    'nao precisa',
    'recuso'
];

// Color translation mappings from Portuguese to English
const COLOR_TRANSLATIONS = {
    'preto': 'black', 'preta': 'black',
    'azul': 'blue',
    'verde': 'green',
    'branco': 'white', 'branca': 'white',
    'rosa': 'pink',
    'dourado': 'gold', 'dourada': 'gold',
    'prata': 'silver',
    'cinza': 'grey', 'gray': 'grey',
    'vermelho': 'red', 'vermelha': 'red'
};

// Standard color list extractor for capinhas
function extractColorName(text) {
    const colors = ['preto', 'preta', 'azul', 'verde', 'branco', 'branca', 'rosa', 'dourado', 'dourada', 'prata', 'cinza', 'vermelho', 'vermelha'];
    for (const color of colors) {
        if (text.toLowerCase().includes(color)) {
            // Normalize to Portuguese uppercase representation
            const normalized = color.charAt(0).toUpperCase() + color.slice(1);
            // Convert to standard gender if needed, or return matched
            return normalized;
        }
    }
    return null;
}

export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase();

    if (!context || !context.order_context || !context.conversation_context) {
        return { success: false, response: '', routing: null, context };
    }

    // Initialize benefits block in order_context if not exists
    if (!context.order_context.benefits) {
        context.order_context.benefits = {};
    }

    // 1. Detect dynamic model switch
    if (text.length > 3 && !/^\d+$/.test(text)) {
        const searchRes = await ProductService.findProducts({ model: text });
        if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
            const foundProduct = searchRes.data[0];
            if (foundProduct.id !== context.order_context.cart.product_id) {
                // Switch product, clear selections and benefits
                context.order_context.cart.product_id = foundProduct.id;
                context.order_context.cart.selected_memory = null;
                context.order_context.cart.selected_color = null;
                context.order_context.benefits = {};

                context.conversation_context.state.flow = SKILLS.PRODUTO;
                context.conversation_context.state.step = STATES.INIT;
                context.conversation_context.routing.last_intent = 'switch_product_during_color';

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
            response: 'Por favor, selecione um produto do catálogo primeiro.',
            routing: { nextSkill: SKILLS.CATALOGO },
            context
        };
    }

    const step = context.conversation_context.state.step || STATES.INIT;
    const waitingFor = context.conversation_context.state.waiting_for || WAITING_FOR.NONE;

    // Fetch product details
    const productRes = await ProductService.getProductPresentation(productId);
    if (!productRes.success || !productRes.data) {
        return {
            success: true,
            response: 'Desculpe, o produto selecionado está indisponível. Vamos voltar ao catálogo?',
            routing: { nextSkill: SKILLS.CATALOGO },
            context
        };
    }

    const { model: modelName, variations } = productRes.data;
    const selectedMemory = context.order_context.cart.selected_memory;

    // Filter variations by selected memory to get unique available colors
    const filteredVariations = selectedMemory ? variations.filter(v => v.memory === selectedMemory) : variations;
    const uniqueColors = [];
    filteredVariations.forEach(v => {
        if (v.colors) {
            v.colors.forEach(c => {
                if (!uniqueColors.includes(c)) {
                    uniqueColors.push(c);
                }
            });
        }
    });

    if (uniqueColors.length === 0) {
        uniqueColors.push('Padrão');
    }

    // --- STEP 1: PRESENT COLOR OPTIONS OR PROCESS COLOR RESPONSE ---
    if (step === STATES.INIT) {
        // Save unique colors as active list for numeric input mapping
        context.conversation_context.routing.last_active_list = uniqueColors;

        const optionsText = uniqueColors.map((color, i) => `${i + 1}. ${color}`).join('\n');
        const responseText = `Ótimo! Agora vamos escolher a cor do seu ${modelName}.\n\nCores disponíveis:\n${optionsText}\n\nQual cor você prefere?`;

        // Validate via PolicyEngine
        const validation = PolicyEngine.validate(responseText, context);
        if (!validation.approved) {
            context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
            return { success: false, response: '', routing: null, context };
        }

        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = WAITING_FOR.COLOR_SELECTION;
        context.conversation_context.conversation.last_bot_question = responseText;
        context.conversation_context.routing.last_intent = 'ask_color';
        context.conversation_context.routing.validation_status = VALIDATION.PASSED;

        return {
            success: true,
            response: responseText,
            routing: null,
            context
        };
    }

    // --- STEP 2: PROCESSING COLOR SELECTION ---
    if (step === STATES.AWAITING_INPUT && waitingFor === WAITING_FOR.COLOR_SELECTION) {
        let matchedColor = null;

        // Check index number selection
        const selectedNumber = parseInt(text, 10);
        const lastActiveList = context.conversation_context.routing.last_active_list || uniqueColors;
        if (Number.isFinite(selectedNumber) && selectedNumber > 0 && selectedNumber <= lastActiveList.length) {
            matchedColor = lastActiveList[selectedNumber - 1];
        } else {
            // Text matching (case insensitive/natural language)
            for (const color of lastActiveList) {
                const colorLower = color.toLowerCase();
                if (cleanText.includes(colorLower)) {
                    matchedColor = color;
                    break;
                }
                // Check translation mapping (e.g. 'preta' matches 'black')
                for (const [pt, en] of Object.entries(COLOR_TRANSLATIONS)) {
                    if (cleanText.includes(pt) && colorLower === en) {
                        matchedColor = color;
                        break;
                    }
                }
                if (matchedColor) break;
            }
        }

        if (!matchedColor) {
            // Re-present valid options on invalid color selection
            const optionsText = uniqueColors.map((color, i) => `${i + 1}. ${color}`).join('\n');
            const invalidResponse = `Não consegui identificar essa cor. Por favor, escolha uma das opções válidas:\n\n${optionsText}\n\nQual cor você prefere?`;

            const validation = PolicyEngine.validate(invalidResponse, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.conversation.last_bot_question = invalidResponse;
            context.conversation_context.routing.last_intent = 'select_color_invalid';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: invalidResponse,
                routing: null,
                context
            };
        }

        // Save selected color
        context.order_context.cart.selected_color = matchedColor;

        // Fetch eligible benefits from PromotionService
        const benefitsRes = await PromotionService.getEligibleBenefits({
            productId,
            memory: selectedMemory,
            color: matchedColor,
            customer: context.customer_context,
            cart: context.order_context.cart
        });

        const benefitsList = (benefitsRes.success && benefitsRes.data) ? benefitsRes.data : [];

        // Save benefits list to context
        benefitsList.forEach(b => {
            if (b.requiresSelection) {
                context.order_context.benefits[b.id] = {
                    eligible: true,
                    accepted: null,
                    pending: true,
                    accessory_id: null,
                    color: null
                };
            } else {
                context.order_context.benefits[b.id] = {
                    eligible: true,
                    accepted: true
                };
            }
        });

        // Check if there are interactive benefits pending choice
        const pendingBenefit = benefitsList.find(b => b.requiresSelection);

        let responseText = '';
        if (benefitsList.length > 0) {
            responseText = `🎁 Sua compra possui os seguintes benefícios:\n` +
                benefitsList.map(b => `✅ ${b.name}`).join('\n') + `\n\n`;
        }

        if (pendingBenefit) {
            // Retrieve compatible accessories (e.g. cases)
            const accessoriesRes = await ProductService.getCompatibleAccessories(productId, selectedMemory, matchedColor);
            const accessories = (accessoriesRes.success && accessoriesRes.data) ? accessoriesRes.data : [];

            context.conversation_context.routing.last_active_list = accessories.map(a => a.name);

            if (accessories.length > 0) {
                const accessoriesText = accessories.map((acc, i) => `${i + 1}. ${acc.name}`).join('\n');
                responseText += `E você ganhou uma capinha de brinde! Escolha uma das opções:\n\n${accessoriesText}\n\nQual cor da capinha você deseja? (Você também pode escolher depois ou recusar)`;
            } else {
                responseText += `Qual cor da capinha você deseja? (Você também pode escolher depois ou recusar)`;
            }

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'case_selection';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'select_case_start';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: null,
                context
            };
        } else {
            // No interactive benefits -> proceed directly to ENTREGA
            responseText += `Perfeito! Cor ${matchedColor} selecionada. Vamos prosseguir para a entrega.`;
            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.flow = SKILLS.ENTREGA;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.routing.last_intent = 'benefits_no_interaction';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: { nextSkill: SKILLS.ENTREGA },
                context
            };
        }
    }

    // --- STEP 3: PROCESSING CASE CHOICE (ACCEPT, REFUSE, OR POSTPONE) ---
    if (step === STATES.AWAITING_INPUT && waitingFor === 'case_selection') {
        const isPostponed = POSTPONE_KEYWORDS.some(kw => cleanText.includes(kw));
        const isRefused = REFUSE_KEYWORDS.some(kw => cleanText.includes(kw));

        const caseBenefitKey = Object.keys(context.order_context.benefits).find(key => key.includes('case'));

        if (isPostponed) {
            if (caseBenefitKey) {
                context.order_context.benefits[caseBenefitKey].accepted = true;
                context.order_context.benefits[caseBenefitKey].pending = true;
                context.order_context.benefits[caseBenefitKey].accessory_id = null;
                context.order_context.benefits[caseBenefitKey].color = null;
            }

            const responseText = 'Tudo bem! Você pode escolher a cor da capinha depois. Vamos prosseguir para a entrega.';
            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.flow = SKILLS.ENTREGA;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.routing.last_intent = 'case_postponed';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: { nextSkill: SKILLS.ENTREGA },
                context
            };
        }

        if (isRefused) {
            if (caseBenefitKey) {
                context.order_context.benefits[caseBenefitKey].accepted = false;
                context.order_context.benefits[caseBenefitKey].pending = false;
                context.order_context.benefits[caseBenefitKey].accessory_id = null;
                context.order_context.benefits[caseBenefitKey].color = null;
            }

            const responseText = 'Sem problemas, prosseguiremos sem a capinha. Vamos para a entrega.';
            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.flow = SKILLS.ENTREGA;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.routing.last_intent = 'case_refused';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: { nextSkill: SKILLS.ENTREGA },
                context
            };
        }

        // Try mapping choice to compatible accessories
        const accessoriesRes = await ProductService.getCompatibleAccessories(productId, selectedMemory, context.order_context.cart.selected_color);
        const accessories = (accessoriesRes.success && accessoriesRes.data) ? accessoriesRes.data : [];

        let chosenAccessory = null;

        const selectedNumber = parseInt(text, 10);
        if (Number.isFinite(selectedNumber) && selectedNumber > 0 && selectedNumber <= accessories.length) {
            chosenAccessory = accessories[selectedNumber - 1];
        } else {
            // Find by matching name string
            for (const acc of accessories) {
                if (cleanText.includes(acc.name.toLowerCase())) {
                    chosenAccessory = acc;
                    break;
                }
            }
        }

        // If selection is valid
        if (chosenAccessory) {
            const extractedColor = extractColorName(chosenAccessory.name) || extractColorName(text) || 'Padrão';

            if (caseBenefitKey) {
                context.order_context.benefits[caseBenefitKey].accepted = true;
                context.order_context.benefits[caseBenefitKey].pending = false;
                context.order_context.benefits[caseBenefitKey].accessory_id = chosenAccessory.id;
                context.order_context.benefits[caseBenefitKey].color = extractedColor;
            }

            const responseText = `Ótima escolha! Capinha na cor ${extractedColor} adicionada aos brindes. Vamos prosseguir para a entrega.`;
            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.flow = SKILLS.ENTREGA;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.routing.last_intent = 'case_selected_success';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: { nextSkill: SKILLS.ENTREGA },
                context
            };
        }

        // Invalid choice -> ask again
        const accessoriesText = accessories.map((acc, i) => `${i + 1}. ${acc.name}`).join('\n');
        const invalidResponse = `Opção de capinha inválida. Escolha uma das opções:\n\n${accessoriesText}\n\nQual cor da capinha você deseja? (Ou envie "recuso" ou "depois")`;

        const validation = PolicyEngine.validate(invalidResponse, context);
        if (!validation.approved) {
            context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
            return { success: false, response: '', routing: null, context };
        }

        context.conversation_context.conversation.last_bot_question = invalidResponse;
        context.conversation_context.routing.last_intent = 'select_case_invalid';
        context.conversation_context.routing.validation_status = VALIDATION.PASSED;

        return {
            success: true,
            response: invalidResponse,
            routing: null,
            context
        };
    }

    return { success: false, response: '', routing: null, context };
}
