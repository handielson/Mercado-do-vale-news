import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import * as PaymentService from '../04-actions/PaymentService.js';

// Payment method keywords
const PIX_KEYWORDS = ['pix', 'à vista', 'a vista', 'avista'];
const DINHEIRO_KEYWORDS = ['dinheiro', 'espécie', 'especie'];
const CARD_KEYWORDS = ['cartão', 'cartao', 'crédito', 'credito', 'parcelado', 'parcela', 'vezes'];
const MIXED_KEYWORDS = ['misto', 'entrada', 'vou dar', 'metade no pix', 'entrada e cartão', 'entrada e cartao'];

// Confirmation keywords
const CONFIRM_KEYWORDS = ['sim', 'correto', 'está correto', 'esta correto', 'ok', 'pode ser', 'confirmar', 'confirmo', 'pode', 'podemos', 'continuar'];
const DECLINE_KEYWORDS = ['não', 'nao', 'incorreto', 'errado', 'não está', 'nao esta', 'mudar', 'alterar', 'cancelar', 'voltar'];

export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase();

    if (!context || !context.order_context || !context.conversation_context) {
        return { success: false, response: '', routing: null, context };
    }

    // Initialize payment structure if not exists
    if (!context.order_context.payment) {
        context.order_context.payment = {};
    }

    const step = context.conversation_context.state.step || STATES.INIT;
    const waitingFor = context.conversation_context.state.waiting_for || WAITING_FOR.NONE;

    // Helper: extract numeric value from string (robust parsing for currency and quantity selection)
    const extractNumber = (str) => {
        let clean = str.replace(/r\$/gi, '').replace(/\s/g, '');
        clean = clean.replace(/[,.]00$/, '');
        clean = clean.replace(/,/, '.');
        let val = parseFloat(clean);
        if (isNaN(val)) {
            const match = str.match(/\d+/);
            val = match ? parseInt(match[0], 10) : NaN;
        }
        return isNaN(val) ? null : Math.round(val);
    };

    // Helper: check if message represents a method switch
    const detectMethodSwitch = () => {
        // Only trigger switch if it's not a simple number (which might be installment selection)
        if (/^\d+$/.test(text)) return null;

        if (PIX_KEYWORDS.some(kw => cleanText.includes(kw))) return 'pix';
        if (DINHEIRO_KEYWORDS.some(kw => cleanText.includes(kw))) return 'dinheiro';
        if (MIXED_KEYWORDS.some(kw => cleanText.includes(kw))) return 'misto';
        if (CARD_KEYWORDS.some(kw => cleanText.includes(kw))) return 'cartao';
        return null;
    };

    const switchedMethod = detectMethodSwitch();
    if (switchedMethod && context.order_context.payment.method && context.order_context.payment.method !== switchedMethod) {
        // Clear payment context and switch
        context.order_context.payment = { method: switchedMethod };
        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_method_selection';
    }

    // Parse selection if waiting for method selection
    if (waitingFor === 'payment_method_selection' && !context.order_context.payment.method) {
        let selectedMethod = null;

        // Numeric choice mapping
        const selectedNumber = parseInt(text, 10);
        if (Number.isFinite(selectedNumber) && selectedNumber > 0 && selectedNumber <= 4) {
            const methods = ['pix', 'dinheiro', 'cartao', 'misto'];
            selectedMethod = methods[selectedNumber - 1];
        } else {
            // Text matching
            if (PIX_KEYWORDS.some(kw => cleanText.includes(kw))) {
                selectedMethod = 'pix';
            } else if (DINHEIRO_KEYWORDS.some(kw => cleanText.includes(kw))) {
                selectedMethod = 'dinheiro';
            } else if (CARD_KEYWORDS.some(kw => cleanText.includes(kw))) {
                selectedMethod = 'cartao';
            } else if (MIXED_KEYWORDS.some(kw => cleanText.includes(kw))) {
                selectedMethod = 'misto';
            }
        }

        if (!selectedMethod) {
            const responseText = 'Opção inválida. Por favor, escolha entre PIX, Dinheiro, Cartão de Crédito ou Pagamento Misto.';
            context.conversation_context.conversation.last_bot_question = responseText;
            return { success: true, response: responseText, routing: null, context };
        }

        context.order_context.payment = { method: selectedMethod };
    }

    // If still no method selected, present selection options
    if (!context.order_context.payment.method) {
        const methodsRes = await PaymentService.getPaymentMethods();
        if (!methodsRes.success || !methodsRes.data) {
            const responseText = 'Não consegui carregar as formas de pagamento. Podemos tentar novamente?';
            return { success: true, response: responseText, routing: null, context };
        }

        const methodsText = methodsRes.data
            .filter(m => m.enabled)
            .map((m, i) => `${i + 1}. ${m.label}`)
            .join('\n');

        const responseText = `💰 Como você deseja realizar o pagamento?\n\nOpções disponíveis:\n${methodsText}\n\nPor favor, digite a opção desejada.`;

        const validation = PolicyEngine.validate(responseText, context);
        if (!validation.approved) {
            context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
            return { success: false, response: '', routing: null, context };
        }

        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_method_selection';
        context.conversation_context.conversation.last_bot_question = responseText;
        context.conversation_context.routing.last_intent = 'ask_payment_method';
        context.conversation_context.routing.validation_status = VALIDATION.PASSED;

        return { success: true, response: responseText, routing: null, context };
    }

    // Handle Confirmation before calculations (prevents simulation bypass on confirm/decline)
    if (waitingFor === 'payment_confirmation') {
        const isConfirmed = CONFIRM_KEYWORDS.some(kw => cleanText.includes(kw));
        const isDeclined = DECLINE_KEYWORDS.some(kw => cleanText.includes(kw));

        if (isConfirmed) {
            context.conversation_context.state.flow = SKILLS.RESUMO;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.state.waiting_for = WAITING_FOR.NONE;
            context.conversation_context.routing.last_intent = 'payment_confirmed';
            
            return {
                success: true,
                response: 'Excelente! Pagamento confirmado. Vamos para o resumo do seu pedido.',
                routing: { nextSkill: SKILLS.RESUMO },
                context
            };
        } else if (isDeclined) {
            context.order_context.payment = {};
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.state.waiting_for = WAITING_FOR.NONE;
            
            return handle('', {
                ...context,
                conversation_context: {
                    ...context.conversation_context,
                    state: { flow: SKILLS.PAGAMENTO, step: STATES.INIT, waiting_for: WAITING_FOR.NONE }
                }
            });
        } else {
            const responseText = context.conversation_context.conversation.last_bot_question;
            return { success: true, response: responseText, routing: null, context };
        }
    }

    // Get Cart/Delivery/Calc Details
    const cart = context.order_context.cart || {};
    const delivery = context.order_context.delivery || {};
    const calcData = {
        productId: cart.product_id,
        shippingFee: Number(delivery.shipping_fee || 0),
        quantity: Number(cart.quantity || 1)
    };

    const updatedMethod = context.order_context.payment.method;

    // Handle AWAITING INPUT states
    if (updatedMethod === 'cartao' && waitingFor === 'installments_input') {
        const sim = context.order_context.payment.simulation;
        const chosenInstallment = extractNumber(text);

        if (!chosenInstallment || chosenInstallment < 1 || chosenInstallment > sim.card_options.length) {
            const responseText = 'Quantidade de parcelas inválida. Por favor, digite um número de 1 a 12.';
            return { success: true, response: responseText, routing: null, context };
        }

        const option = sim.card_options.find(opt => opt.installment === chosenInstallment);
        context.order_context.payment.selectedOption = option;
        context.order_context.payment.installments = option.installment;
        context.order_context.payment.installment_value = option.amount_per_month;
        context.order_context.payment.total = option.total;
        context.order_context.payment.down_payment = 0;

        const responseText = `Perfeito! Você escolheu pagar em ${option.installment}x de R$ ${option.amount_per_month.toFixed(2)}. Posso continuar?`;

        const validation = PolicyEngine.validate(responseText, context);
        if (!validation.approved) {
            context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
            return { success: false, response: '', routing: null, context };
        }

        context.conversation_context.state.step = STATES.AWAITING_INPUT;
        context.conversation_context.state.waiting_for = 'payment_confirmation';
        context.conversation_context.conversation.last_bot_question = responseText;
        context.conversation_context.routing.last_intent = 'ask_payment_confirm_card';
        context.conversation_context.routing.validation_status = VALIDATION.PASSED;

        return { success: true, response: responseText, routing: null, context };
    }

    if (updatedMethod === 'misto') {
        if (waitingFor === 'down_payment_input') {
            const amount = extractNumber(text);
            if (!amount || amount <= 0) {
                const responseText = 'Valor da entrada inválido. Por favor, envie um valor numérico válido.';
                return { success: true, response: responseText, routing: null, context };
            }

            const simRes = await PaymentService.simulateMixedPayment(calcData, amount);
            if (!simRes.success || !simRes.data) {
                const responseText = simRes.error && simRes.error.code === 'INVALID_DOWN_PAYMENT'
                    ? `O valor da entrada de R$ ${amount.toFixed(2)} deve ser menor que o valor total do pedido. Qual será o valor da entrada?`
                    : 'Não consegui calcular essa forma de pagamento agora. Vamos tentar novamente?';

                return { success: true, response: responseText, routing: null, context };
            }

            const sim = simRes.data;
            context.order_context.payment.down_payment = amount;
            context.order_context.payment.simulation = sim;

            const optionsText = sim.card_balance_options
                .map(opt => `${opt.installment}x de R$ ${opt.amount_per_month.toFixed(2)} (Total parcelado: R$ ${opt.total.toFixed(2)})`)
                .join('\n');

            const responseText = `💵 Entrada de R$ ${amount.toFixed(2)} confirmada! Resta o saldo de R$ ${sim.remaining_balance.toFixed(2)}.\n\nOpções de parcelamento do saldo:\n${optionsText}\n\nEm quantas parcelas você deseja pagar o saldo restante?`;

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'misto_installments_input';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'ask_misto_installments';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return { success: true, response: responseText, routing: null, context };
        }

        if (waitingFor === 'misto_installments_input') {
            const sim = context.order_context.payment.simulation;
            const chosenInstallment = extractNumber(text);

            if (!chosenInstallment || chosenInstallment < 1 || chosenInstallment > sim.card_balance_options.length) {
                const responseText = 'Quantidade de parcelas inválida. Por favor, envie uma das opções simuladas.';
                return { success: true, response: responseText, routing: null, context };
            }

            const option = sim.card_balance_options.find(opt => opt.installment === chosenInstallment);
            context.order_context.payment.selectedOption = option;
            context.order_context.payment.installments = option.installment;
            context.order_context.payment.installment_value = option.amount_per_month;
            context.order_context.payment.total = Number((sim.down_payment + option.total).toFixed(2));

            const responseText = `Perfeito! Você escolheu pagar uma entrada de R$ ${sim.down_payment.toFixed(2)} e o saldo em ${option.installment}x de R$ ${option.amount_per_month.toFixed(2)}. Posso continuar?`;

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'payment_confirmation';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'ask_payment_confirm_misto';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return { success: true, response: responseText, routing: null, context };
        }
    }

    // Step 5: Init calculations/simulations if missing
    if (updatedMethod === 'pix' || updatedMethod === 'dinheiro') {
        if (!context.order_context.payment.simulation) {
            const simRes = await PaymentService.calculatePaymentOptions(calcData);
            if (!simRes.success || !simRes.data) {
                const responseText = 'Não consegui calcular essa forma de pagamento agora. Vamos tentar novamente?';
                return { success: true, response: responseText, routing: null, context };
            }

            const sim = simRes.data;
            const finalVal = updatedMethod === 'pix' ? sim.pix_amount : sim.base_amount;

            context.order_context.payment.total = finalVal;
            context.order_context.payment.installments = 1;
            context.order_context.payment.down_payment = 0;
            context.order_context.payment.installment_value = finalVal;
            context.order_context.payment.simulation = sim;
            context.order_context.payment.selectedOption = {
                installment: 1,
                amount_per_month: finalVal,
                total: finalVal
            };

            const methodLabel = updatedMethod === 'pix' ? 'PIX' : 'Dinheiro';
            const responseText = `Confirmado! O valor final para pagamento no ${methodLabel} é R$ ${finalVal.toFixed(2)}.\n\nPodemos continuar?`;

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'payment_confirmation';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'ask_payment_confirm_cash';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return { success: true, response: responseText, routing: null, context };
        }
    }

    if (updatedMethod === 'cartao') {
        if (!context.order_context.payment.simulation) {
            const simRes = await PaymentService.calculatePaymentOptions(calcData);
            if (!simRes.success || !simRes.data) {
                const responseText = 'Não consegui calcular essa forma de pagamento agora. Vamos tentar novamente?';
                return { success: true, response: responseText, routing: null, context };
            }

            const sim = simRes.data;
            context.order_context.payment.simulation = sim;

            const optionsText = sim.card_options
                .map(opt => `${opt.installment}x de R$ ${opt.amount_per_month.toFixed(2)} (Total: R$ ${opt.total.toFixed(2)})`)
                .join('\n');

            const responseText = `💳 Parcelamento no Cartão de Crédito:\n\nOpções disponíveis:\n${optionsText}\n\nEm quantas parcelas você deseja pagar?`;

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'installments_input';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'ask_installments';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return { success: true, response: responseText, routing: null, context };
        }
    }

    if (updatedMethod === 'misto') {
        if (context.order_context.payment.down_payment === undefined) {
            const responseText = 'Qual será o valor da entrada?';

            const validation = PolicyEngine.validate(responseText, context);
            if (!validation.approved) {
                context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
                return { success: false, response: '', routing: null, context };
            }

            context.conversation_context.state.step = STATES.AWAITING_INPUT;
            context.conversation_context.state.waiting_for = 'down_payment_input';
            context.conversation_context.conversation.last_bot_question = responseText;
            context.conversation_context.routing.last_intent = 'ask_down_payment';
            context.conversation_context.routing.validation_status = VALIDATION.PASSED;

            return { success: true, response: responseText, routing: null, context };
        }
    }

    return { success: false, response: '', routing: null, context };
}
