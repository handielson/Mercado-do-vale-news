import crypto from 'crypto';
import { SKILLS, STATES, WAITING_FOR, VALIDATION } from '../constants.js';
import PolicyEngine from '../03-policies/PolicyEngine.js';
import * as OrderService from '../04-actions/OrderService.js';

export async function handle(message, context) {
    const text = String(message || '').trim();

    if (!context || !context.order_context || !context.conversation_context) {
        return { success: false, response: '', routing: null, context };
    }

    // 1. Idempotency Check (Check if order was already finalized)
    if (context.conversation_context.finished && context.order_context.order && context.order_context.order.number) {
        const order = context.order_context.order;
        const responseText = `Seu pedido já foi realizado com sucesso! 🎉\n\nNúmero do pedido: ${order.number}\nProtocolo: ${order.protocol}\n\nNossa equipe entrará em contato em breve para dar andamento.`;
        return {
            success: true,
            response: responseText,
            routing: null,
            context
        };
    }

    const snapshot = context.order_context.snapshots?.confirmed;
    const confirmation = context.order_context.confirmation || {};

    // 2. Validate Snapshot Presence and confirmed status
    if (!snapshot || confirmation.status !== 'confirmed') {
        return {
            success: true,
            response: 'Ops! O seu resumo de confirmação foi invalidado ou está ausente. Vamos voltar para o resumo?',
            routing: { nextSkill: SKILLS.RESUMO },
            context
        };
    }

    // 3. Verify summaryHash matches current SHA-256 of the confirmed snapshot
    const hash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    if (hash !== confirmation.summaryHash) {
        return {
            success: true,
            response: 'Ops! Os dados do resumo do pedido mudaram e a confirmação é inválida. Vamos voltar para o resumo?',
            routing: { nextSkill: SKILLS.RESUMO },
            context
        };
    }

    // 4. Initialize finalization & idempotencyKey details in context
    if (!context.order_context.finalization) {
        context.order_context.finalization = {};
    }
    if (!context.order_context.finalization.idempotencyKey) {
        context.order_context.finalization.idempotencyKey = 'IDEM-' + context.conversation_id + '-' + (confirmation.version || 1);
    }
    const idempotencyKey = context.order_context.finalization.idempotencyKey;

    // 5. Finalize the order through OrderService (atomic transaction)
    const finalizeRes = await OrderService.finalizeOrder(snapshot, idempotencyKey);

    if (!finalizeRes.success || !finalizeRes.data) {
        const responseText = 'Não foi possível concluir seu pedido neste momento.\nVamos tentar novamente em instantes.';
        return {
            success: true,
            response: responseText,
            routing: null,
            context
        };
    }

    const orderData = finalizeRes.data;

    // 6. Record successfully created order details
    context.order_context.order = {
        id: orderData.orderId,
        number: orderData.orderNumber,
        protocol: orderData.protocol,
        created_at: orderData.createdAt
    };

    // 7. Audit log structure
    context.order_context.audit = {
        finalizedBy: 'AI',
        finalizedAt: orderData.createdAt,
        frameworkVersion: '1.0.0',
        confirmationVersion: confirmation.version || 1,
        snapshotHash: confirmation.summaryHash,
        protocol: orderData.protocol
    };

    // 8. Update conversation context status to completed and finished
    context.order_context.finalization.finalizedAt = orderData.createdAt;
    context.conversation_context.finished = true;
    context.conversation_context.state.step = STATES.COMPLETED;
    context.conversation_context.finished_at = orderData.createdAt;
    context.conversation_context.conversation.last_bot_question = null;

    const responseText = `Pedido realizado com sucesso! 🎉\n\nSeu pedido foi registrado.\n\nNúmero do pedido: ${orderData.orderNumber}\nProtocolo: ${orderData.protocol}\n\nEm breve nossa equipe dará continuidade ao atendimento.`;

    const validation = PolicyEngine.validate(responseText, context);
    if (!validation.approved) {
        context.conversation_context.routing.validation_status = VALIDATION.FAILED_POLICY;
        return { success: false, response: '', routing: null, context };
    }

    context.conversation_context.routing.validation_status = VALIDATION.PASSED;

    return {
        success: true,
        response: responseText,
        routing: null,
        context
    };
}
