import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import * as DeliveryService from '../04-actions/DeliveryService.js';
import * as ProductService from '../04-actions/ProductService.js';

// Modalidade keywords
const PICKUP_KEYWORDS = ['retirar', 'retirada', 'retiro', 'vou buscar', 'passo na loja', 'busco aí', 'retiro pessoalmente'];
const DELIVERY_KEYWORDS = ['entrega', 'entregar', 'quero receber', 'manda aqui', 'enviar', 'delivery', 'entrega em casa'];

// Confirmação keywords
const CONFIRM_KEYWORDS = ['sim', 'correto', 'está correto', 'esta correto', 'ok', 'pode ser', 'confirmar', 'confirmo', 'pode', 'podemos'];
const DECLINE_KEYWORDS = ['não', 'nao', 'incorreto', 'errado', 'não está', 'nao esta', 'mudar', 'alterar'];

// Complement negative keywords
const COMPLEMENT_NEGATIVES = ['não', 'nao', 'não possui', 'nao possui', 'não tem', 'nao tem', 'nenhum', 'deixa sem'];

export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase();

    if (!context || !context.order_context || !context.conversation_context) {
        return { success: false, response: '', routing: null, context };
    }

    // Initialize delivery structure if not exists
    if (!context.order_context.delivery) {
        context.order_context.delivery = {};
    }

    // 1. Detect dynamic model switch
    if (text.length > 3 && !/^\d+$/.test(text) && !cleanText.includes('rua') && !cleanText.includes('avenida')) {
        // Exclude addresses from triggering search by checking basic keywords if it looks like an address
        const isLikelyAddress = cleanText.includes('cep') || cleanText.includes('nº') || cleanText.includes('apto') || cleanText.includes('bairro');
        if (!isLikelyAddress) {
            const searchRes = await ProductService.findProducts({ model: text });
            if (searchRes.success && searchRes.data && searchRes.data.length > 0) {
                const foundProduct = searchRes.data[0];
                if (foundProduct.id !== context.order_context.cart.product_id) {
                    // Switch product, clear selections and delivery context
                    context.order_context.cart.product_id = foundProduct.id;
                    context.order_context.cart.selected_memory = null;
                    context.order_context.cart.selected_color = null;
                    if (context.order_context.benefits) context.order_context.benefits = {};
                    context.order_context.delivery = {};

                    context.conversation_context.state.flow = SKILLS.PRODUTO;
                    context.conversation_context.state.step = STATES.INIT;
                    context.conversation_context.routing.last_intent = 'switch_product_during_delivery';

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
    }

    const method = context.order_context.delivery.method;
    const step = context.conversation_context.state.step || STATES.INIT;
    const waitingFor = context.conversation_context.state.waiting_for || WAITING_FOR.NONE;

    // Preserve original message
    if (text) {
        context.order_context.delivery.original_message = text;
    }

    let messageTextToResolve = text;

    // --- STEP 1: IDENTIFY PICKUP OR DELIVERY METHOD ---
    if (!method) {
        let detectedMethod = null;
        if (PICKUP_KEYWORDS.some(kw => cleanText.includes(kw))) {
            detectedMethod = 'pickup';
        } else if (DELIVERY_KEYWORDS.some(kw => cleanText.includes(kw))) {
            detectedMethod = 'delivery';
        }

        if (detectedMethod === 'pickup') {
            context.order_context.delivery.method = 'pickup';
            context.conversation_context.state.flow = SKILLS.PAGAMENTO;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.routing.last_intent = 'select_pickup';
            
            const responseText = 'Combinado! Você pode retirar o aparelho diretamente na nossa loja. Vamos prosseguir para o pagamento.';
            return {
                success: true,
                response: responseText,
                routing: { nextSkill: SKILLS.PAGAMENTO },
                context
            };
        } else if (detectedMethod === 'delivery') {
            context.order_context.delivery.method = 'delivery';
            // Clear messageTextToResolve so we don't parse the selection phrase as the address itself
            messageTextToResolve = '';
        } else {
            const responseText = 'Você prefere retirar na loja ou receber por entrega?';
            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'delivery_method_selection';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'ask_delivery_method';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: null,
                context
            };
        }
    }

    // --- STEP 2: ADDRESS GATHERING FLOW ---
    if (context.order_context.delivery.method === 'delivery') {
        // Handle input based on current waitingFor state
        if (waitingFor === 'number_input' && /^\d+$/.test(text)) {
            context.order_context.delivery.number = text;
        } else if (waitingFor === 'complement_input') {
            const isNegative = COMPLEMENT_NEGATIVES.some(kw => cleanText.includes(kw));
            if (isNegative) {
                context.order_context.delivery.complement = 'Não possui';
            } else {
                context.order_context.delivery.complement = text;
            }
        }

        // Parse location sharing coordinates if message matches
        const location = (typeof message === 'object' && message !== null && message.latitude && message.longitude) ? message : null;

        // Call resolveAddress action
        const resolveRes = await DeliveryService.resolveAddress({
            message: typeof message === 'string' ? messageTextToResolve : '',
            location,
            context
        });

        if (!resolveRes.success || !resolveRes.data) {
            // Amical technical error message
            const responseText = 'Não consegui confirmar esse endereço agora. Pode conferir o CEP ou enviar o endereço novamente?';
            return {
                success: true,
                response: responseText,
                routing: null,
                context
            };
        }

        const { address, missingFields, readyForConfirmation } = resolveRes.data;

        // Save resolved address properties to context
        context.order_context.delivery.address = address;
        context.order_context.delivery.raw_cep = address.cep;
        context.order_context.delivery.raw_address = address.street;
        context.order_context.delivery.number = address.number;
        context.order_context.delivery.complement = address.complement;
        context.order_context.delivery.reference = address.reference;

        if (location) {
            context.order_context.delivery.location = location;
        }

        // Step 2A: Confirming Address
        if (waitingFor === 'address_confirmation') {
            const isConfirmed = CONFIRM_KEYWORDS.some(kw => cleanText.includes(kw));
            const isDeclined = DECLINE_KEYWORDS.some(kw => cleanText.includes(kw));

            if (isConfirmed) {
                // Calculate Freight using only resolved CEP
                const freightRes = await DeliveryService.calculateFreight(address.cep || '56300000');
                const fee = (freightRes.success && freightRes.data) ? freightRes.data.fee : 15.00;
                const days = (freightRes.success && freightRes.data) ? freightRes.data.estimated_days : 2;

                context.order_context.delivery.shipping_fee = fee;
                context.order_context.delivery.shipping_deadline = days;

                let responseText = `Perfeito! O frete para esse endereço ficou em R$ ${fee.toFixed(2)}.`;
                if (days) {
                    responseText += ` Prazo estimado: ${days} dias úteis.`;
                }
                responseText += '\n\nPodemos continuar?';

                const validation = PolicyEngine.validate(responseText, context);
                if (!validation.approved) {
                    context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                    return { success: false, response: '', routing: null, context };
                }

                context.conversation_context.state.step = STATES.AWAITING_INPUT;
                context.conversation_context.state.waiting_for = 'freight_confirmation';
                context.conversation_context.conversation.last_bot_question = responseText;
                context.conversation_context.routing.last_intent = 'ask_freight_confirm';
                context.conversation_context.routing.validation_status = VALIDATION.PASSED;

                return {
                    success: true,
                    response: responseText,
                    routing: null,
                    context
                };
            } else if (isDeclined) {
                // Clear address and start over
                context.order_context.delivery.address = null;
                context.order_context.delivery.number = null;
                context.order_context.delivery.complement = null;
                context.order_context.delivery.raw_cep = null;
                context.order_context.delivery.raw_address = null;

                const responseText = 'Entendido. Por favor, envie o CEP ou endereço correto novamente.';
                return {
                    success: true,
                    response: responseText,
                    routing: null,
                    context: {
                        ...context,
                        conversation_context: {
                            ...context.conversation_context,
                            state: { flow: SKILLS.ENTREGA, step: STATES.AWAITING_INPUT, waiting_for: 'address_input' }
                        }
                    }
                };
            }
        }

        // Step 2B: Confirming Freight
        if (waitingFor === 'freight_confirmation') {
            const isConfirmed = CONFIRM_KEYWORDS.some(kw => cleanText.includes(kw));
            if (isConfirmed) {
                context.order_context.delivery.shipping_confirmed = true;
                context.conversation_context.state.flow = SKILLS.PAGAMENTO;
                context.conversation_context.state.step = STATES.INIT;
                context.conversation_context.routing.last_intent = 'shipping_confirmed_success';

                return {
                    success: true,
                    response: 'Ótimo! Endereço e entrega confirmados. Vamos prosseguir para a etapa de pagamento.',
                    routing: { nextSkill: SKILLS.PAGAMENTO },
                    context
                };
            }
        }

        // Ask missing fields or present confirmation
        if (missingFields.length > 0) {
            const nextField = missingFields[0];
            let responseText = '';
            let nextWaiting = '';

            if (nextField === 'cep') {
                responseText = 'Por favor, informe o CEP ou endereço completo de entrega.';
                nextWaiting = 'address_input';
            } else if (nextField === 'number') {
                responseText = 'Qual é o número?';
                nextWaiting = 'number_input';
            } else if (nextField === 'complement') {
                responseText = 'Possui complemento?';
                nextWaiting = 'complement_input';
            }

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = nextWaiting;
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = `ask_missing_${nextField}`;
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: null,
                context
            };
        } else if (readyForConfirmation) {
            const numText = address.number ? `, Nº ${address.number}` : '';
            const complText = (address.complement && address.complement !== 'Não possui') ? ` - ${address.complement}` : '';
            const refText = address.reference ? ` (Ref: ${address.reference})` : '';
            
            const fullAddressText = `${address.street}${numText}${complText}, ${address.district}, ${address.city} - ${address.state}${refText}`;
            const responseText = `📍 Endereço de entrega:\n${fullAddressText}\n\nEstá correto?`;

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'address_confirmation';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'ask_address_confirm';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return {
                success: true,
                response: responseText,
                routing: null,
                context
            };
        }
    }

    return { success: false, response: '', routing: null, context };
}
