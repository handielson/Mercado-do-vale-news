import crypto from 'crypto';
import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';

// Change intention keywords
const COLOR_CHANGE_KEYWORDS = ['mudar a cor', 'mudar cor', 'trocar cor', 'outra cor', 'trocar a cor'];
const PAYMENT_CHANGE_KEYWORDS = ['mudar pagamento', 'mudar o pagamento', 'trocar pagamento', 'mudar a forma de pagamento', 'trocar a forma de pagamento', 'pix', 'dinheiro', 'cartão', 'cartao', 'misto', 'forma de pagamento'];
const DELIVERY_CHANGE_KEYWORDS = ['mudar entrega', 'mudar a entrega', 'trocar entrega', 'mudar endereço', 'mudar o endereço', 'mudar endereco', 'mudar o endereco', 'retirar', 'retirada', 'entrega', 'endereço', 'endereco'];
const PRODUCT_CHANGE_KEYWORDS = ['mudar produto', 'mudar o produto', 'trocar produto', 'mudar modelo', 'mudar o modelo', 'trocar modelo', 'outro modelo', 'outro celular', 'outro aparelho'];

// Confirmation keywords
const CONFIRM_KEYWORDS = ['sim', 'correto', 'está correto', 'esta correto', 'confirmado', 'pode', 'pode finalizar', 'está tudo correto', 'esta tudo correto', 'finalizar', 'fechar'];
const DECLINE_KEYWORDS = ['não', 'nao', 'não está', 'nao esta', 'errado', 'incorreto'];

export async function handle(message, context) {
    const text = String(message || '').trim();
    const cleanText = text.toLowerCase();

    if (!context || !context.order_context || !context.conversation_context) {
        return { success: false, response: '', routing: null, context };
    }

    // Initialize structures
    if (!context.order_context.confirmation) {
        context.order_context.confirmation = {
            version: 1,
            status: 'pending',
            generatedAt: null,
            summaryHash: null
        };
    }
    if (!context.order_context.snapshots) {
        context.order_context.snapshots = {
            current: null,
            confirmed: null
        };
    }

    const cart = context.order_context.cart || {};
    const delivery = context.order_context.delivery || {};
    const payment = context.order_context.payment || {};
    const benefits = context.order_context.benefits || {};

    // --- STEP 1: VALIDATE REQUIRED FIELDS ---
    if (!cart.product_id || !cart.selected_memory || !cart.selected_color) {
        return {
            success: true,
            response: 'Ops! Algumas informações do produto estão faltando. Vamos voltar para escolher o aparelho?',
            routing: { nextSkill: SKILLS.PRODUTO },
            context
        };
    }

    if (!delivery.method || (delivery.method === 'delivery' && !delivery.address)) {
        return {
            success: true,
            response: 'Ops! As informações de entrega estão incompletas. Vamos voltar para preencher o endereço?',
            routing: { nextSkill: SKILLS.ENTREGA },
            context
        };
    }

    if (!payment.method || !payment.simulation) {
        return {
            success: true,
            response: 'Ops! A forma de pagamento não foi definida. Vamos voltar para escolher a forma de pagamento?',
            routing: { nextSkill: SKILLS.PAGAMENTO },
            context
        };
    }

    // --- STEP 2: BUILD CURRENT SNAPSHOT AND COMPUTE HASH ---
    const newSnapshot = {
        cart: {
            product_id: cart.product_id,
            model_name: cart.model || cart.model_name || 'Smartphone',
            memory: cart.selected_memory,
            color: cart.selected_color,
            quantity: cart.quantity || 1
        },
        benefits: JSON.parse(JSON.stringify(benefits)),
        delivery: {
            method: delivery.method,
            raw_cep: delivery.raw_cep,
            address: delivery.address,
            number: delivery.number,
            complement: delivery.complement,
            reference: delivery.reference,
            shipping_fee: delivery.shipping_fee,
            shipping_deadline: delivery.shipping_deadline
        },
        payment: {
            method: payment.method,
            installments: payment.installments,
            down_payment: payment.down_payment,
            total: payment.total,
            installment_value: payment.installment_value,
            selectedOption: payment.selectedOption
        }
    };

    const newHash = crypto.createHash('sha256').update(JSON.stringify(newSnapshot)).digest('hex');

    // Invalidate if hash changed (meaning context changed outside ResumoSkill)
    if (context.order_context.confirmation.summaryHash && context.order_context.confirmation.summaryHash !== newHash) {
        context.order_context.confirmation.status = 'invalidated';
        context.order_context.confirmation.version++;
        context.order_context.snapshots.confirmed = null; // Clear old confirmed snapshot
    }

    context.order_context.snapshots.current = newSnapshot;
    context.order_context.confirmation.summaryHash = newHash;
    context.order_context.confirmation.generatedAt = new Date().toISOString();

    if (context.order_context.confirmation.status === 'invalidated') {
        context.order_context.confirmation.status = 'pending';
    }

    const step = context.conversation_context.state.step || STATES.INIT;
    const waitingFor = context.conversation_context.state.waiting_for || WAITING_FOR.NONE;

    // --- STEP 3: INTERPRET CHANGES / CONFIRMATIONS (AWAITING INPUT) ---
    if (step === STATES.AWAITING_INPUT && waitingFor === 'final_confirmation') {
        // Detect change requests
        let routeSkill = null;

        if (COLOR_CHANGE_KEYWORDS.some(kw => cleanText.includes(kw))) {
            routeSkill = SKILLS.ESCOLHA_COR;
        } else if (PAYMENT_CHANGE_KEYWORDS.some(kw => cleanText.includes(kw))) {
            routeSkill = SKILLS.PAGAMENTO;
        } else if (DELIVERY_CHANGE_KEYWORDS.some(kw => cleanText.includes(kw))) {
            routeSkill = SKILLS.ENTREGA;
        } else if (PRODUCT_CHANGE_KEYWORDS.some(kw => cleanText.includes(kw))) {
            routeSkill = SKILLS.PRODUTO;
        }

        if (routeSkill) {
            context.order_context.confirmation.status = 'invalidated';
            context.order_context.confirmation.version++;
            context.order_context.snapshots.confirmed = null; // Reset confirmed snapshot since details will change

            context.conversation_context.state.flow = routeSkill;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.state.waiting_for = WAITING_FOR.NONE;

            const routeLabel = routeSkill === SKILLS.ESCOLHA_COR ? 'cor' :
                               routeSkill === SKILLS.PAGAMENTO ? 'pagamento' :
                               routeSkill === SKILLS.ENTREGA ? 'entrega' : 'produto';

            return {
                success: true,
                response: `Tudo bem, vamos alterar a opção de ${routeLabel}.`,
                routing: { nextSkill: routeSkill },
                context
            };
        }

        // Detect positive/negative confirmation
        const isConfirmed = CONFIRM_KEYWORDS.some(kw => cleanText.includes(kw));
        const isDeclined = DECLINE_KEYWORDS.some(kw => cleanText.includes(kw));

        if (isConfirmed) {
            context.order_context.confirmation.status = 'confirmed';
            context.order_context.snapshots.confirmed = JSON.parse(JSON.stringify(newSnapshot)); // Immutable snapshot copy

            context.conversation_context.state.flow = SKILLS.FINALIZACAO;
            context.conversation_context.state.step = STATES.INIT;
            context.conversation_context.state.waiting_for = WAITING_FOR.NONE;
            context.conversation_context.routing.last_intent = 'resumo_confirmed_final';

            return {
                success: true,
                response: 'Excelente! Pedido confirmado. Vamos prosseguir para a finalização.',
                routing: { nextSkill: SKILLS.FINALIZACAO },
                context
            };
        } else if (isDeclined) {
            context.order_context.confirmation.status = 'invalidated';
            context.order_context.confirmation.version++;
            context.order_context.snapshots.confirmed = null;

            const responseText = 'Entendido. O que você gostaria de alterar? (Você pode mudar o modelo, a cor, a entrega ou a forma de pagamento)';
            return {
                success: true,
                response: responseText,
                routing: null,
                context
            };
        }
    }

    // --- STEP 4: PRESENT SUMMARY ---
    // Format benefits
    const benefitsList = [];
    Object.entries(benefits).forEach(([key, val]) => {
        if (val.eligible && val.accepted) {
            if (key.includes('case') && val.color) {
                benefitsList.push(`Capinha de silicone na cor ${val.color}`);
            } else if (key.includes('screen_protector')) {
                benefitsList.push('Película 3D de vidro');
            } else {
                benefitsList.push(key);
            }
        }
    });
    const benefitsText = benefitsList.length > 0
        ? benefitsList.map(b => `🎁 ${b}`).join('\n')
        : 'Sem benefícios/brindes aplicados.';

    // Format Recebimento
    let deliveryText = '';
    if (newSnapshot.delivery.method === 'pickup') {
        deliveryText = '🚚 Recebimento: Retirada na loja física (Sem frete)';
    } else {
        const addr = newSnapshot.delivery.address;
        const numText = addr.number ? `, Nº ${addr.number}` : '';
        const complText = (addr.complement && addr.complement !== 'Não possui') ? ` - ${addr.complement}` : '';
        const fullAddress = `${addr.street}${numText}${complText}, ${addr.district}, ${addr.city} - ${addr.state}`;
        deliveryText = `🚚 Recebimento: Entrega por Delivery\n📍 Endereço: ${fullAddress}\n💵 Frete: R$ ${newSnapshot.delivery.shipping_fee.toFixed(2)} (Prazo: ${newSnapshot.delivery.shipping_deadline} dias úteis)`;
    }

    // Format Pagamento
    let paymentText = '';
    const pay = newSnapshot.payment;
    if (pay.method === 'pix') {
        paymentText = `💳 Pagamento: PIX à vista\n💰 Total: R$ ${pay.total.toFixed(2)}`;
    } else if (pay.method === 'dinheiro') {
        paymentText = `💳 Pagamento: Dinheiro\n💰 Total: R$ ${pay.total.toFixed(2)}`;
    } else if (pay.method === 'cartao') {
        paymentText = `💳 Pagamento: Cartão de Crédito\n💰 Detalhes: ${pay.installments}x de R$ ${pay.installment_value.toFixed(2)} (Total: R$ ${pay.total.toFixed(2)})`;
    } else if (pay.method === 'misto') {
        paymentText = `💳 Pagamento: Misto\n💰 Detalhes: Entrada de R$ ${pay.down_payment.toFixed(2)} + ${pay.installments}x de R$ ${pay.installment_value.toFixed(2)} no Cartão\n💵 Total final: R$ ${pay.total.toFixed(2)}`;
    }

    const responseText = `📝 Resumo do seu Pedido:\n\n` +
        `📱 Aparelho:\n` +
        `Modelo: ${newSnapshot.cart.model_name}\n` +
        `Memória: ${newSnapshot.cart.memory}\n` +
        `Cor: ${newSnapshot.cart.color}\n\n` +
        `🎁 Brindes e Benefícios:\n` +
        `${benefitsText}\n\n` +
        `${deliveryText}\n\n` +
        `${paymentText}\n\n` +
        `Está tudo correto para finalizar seu pedido?`;

    const validation = PolicyEngine.validate(responseText, context);
    if (!validation.approved) {
        context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
        return { success: false, response: '', routing: null, context };
    }

    context.conversation_context.state.step = STATES.AWAITING_INPUT;
    context.conversation_context.state.waiting_for = 'final_confirmation';
    context.conversation_context.conversation.last_bot_question = responseText;
    context.conversation_context.routing.last_intent = 'present_summary';
    context.conversation_context.routing.validation_status = VALIDATION.PASSED;

    return { success: true, response: responseText, routing: null, context };
}
