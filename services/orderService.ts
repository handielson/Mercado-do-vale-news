/**
 * Order Service — Pedidos Online (E-commerce)
 * Separado do saleService (PDV). Gerencia o ciclo de vida dos pedidos online.
 */

import { supabase } from './supabase';
import type {
    Order,
    OrderInput,
    OrderWithItems,
    OrderFilters,
    OrderStatus,
    OrderPaymentStatus,
    GatewayPaymentResult,
} from '../types/order';

import { paymentIntegrationService } from './paymentIntegrationService';
import { mercadoPagoProvider } from './providers/mercadoPagoProvider';
import { telegramBotService } from './telegramBot';
import { formatCurrency } from '../utils/saleCalculations';
import { addPendingCoinsForPurchase, confirmPendingCoins, cancelPendingCoins, cancelReferralReward } from './cashbackService';
import { unitService } from './units';
import { UnitStatus } from '../utils/field-standards';
import { stockLocationService } from './stockLocationService';
import { syncStockToBling } from './blingService';
import { vpsApiService } from './vpsApiService';


const COMPANY_SLUG = 'mercado-do-vale';

// ─── Helper: monta dados para notificação Telegram ────────────────────────────
function buildOrderNotificationData(
    order: any,
    items: any[],
    extra?: { installments?: number; cardBrand?: string }
) {
    const total = order.total ?? 0;
    const installments = extra?.installments ?? 1;
    const installmentValue = installments > 1 ? Math.round(total / installments) : total;

    let pagamento: string;
    if (order.payment_method === 'pix') {
        pagamento = `🟢 PIX — *${formatCurrency(total)} à vista*`;
    } else if (order.payment_method === 'credit_card') {
        const brand = extra?.cardBrand ? ` (${extra.cardBrand})` : '';
        if (installments > 1) {
            pagamento = `💳 Cartão${brand} — *${installments}x de ${formatCurrency(installmentValue)}*\n   Total: ${formatCurrency(total)}`;
        } else {
            pagamento = `💳 Cartão${brand} — *${formatCurrency(total)} à vista*`;
        }
    } else {
        const quando = order.delivery_type === 'pickup' ? 'na retirada' : 'na entrega';
        pagamento = `💵 Pagar ${quando} — *${formatCurrency(total)}*`;
    }

    const itens = items
        .map(i => `• ${i.product_name} x${i.quantity} — ${formatCurrency(i.subtotal)}`)
        .join('\n');
    const entrega = order.delivery_type === 'pickup' ? 'Retirada na loja' : 'Entrega em casa';
    const addr = order.shipping_address;
    const endereco = addr
        ? `${addr.street}${addr.number ? ', ' + addr.number : ''}${addr.complement ? ' — ' + addr.complement : ''} — ${addr.neighborhood}, ${addr.city}/${addr.state}`
        : 'Retirada presencial';
    return {
        id_pedido: order.id?.slice(0, 8) ?? '?',
        cliente: order.customer_name ?? '-',
        telefone: order.customer_phone ?? '-',
        itens,
        valor: formatCurrency(total),
        pagamento,
        entrega,
        endereco,
    };
}

function getDeliveryLabel(deliveryType: string) {
    return deliveryType === 'pickup' ? 'Retirada na loja' : 'Entrega em casa';
}

function getAddressLabel(shippingAddress: any) {
    if (!shippingAddress) return 'Retirada presencial';
    return `${shippingAddress.street}${shippingAddress.number ? ', ' + shippingAddress.number : ''}${shippingAddress.complement ? ' — ' + shippingAddress.complement : ''} — ${shippingAddress.neighborhood}, ${shippingAddress.city}/${shippingAddress.state}`;
}

function getPaymentLabel(paymentMethod: string) {
    if (paymentMethod === 'pix') return 'PIX';
    if (paymentMethod === 'credit_card') return 'Cartão de crédito';
    if (paymentMethod === 'debit_card') return 'Cartão de débito';
    if (paymentMethod === 'on_delivery') return 'Pagamento na entrega/retirada';
    return paymentMethod || 'Não informado';
}

async function calculateOrderCostAndProfit(items: Array<{ product_id?: string; quantity?: number }>, totalSale: number) {
    const productIds = Array.from(
        new Set(items.map(i => i.product_id).filter(Boolean) as string[])
    );

    let totalCost = 0;
    if (productIds.length > 0) {
        const productRows = await vpsApiService.getProductsByIds(productIds);

        const costMap = new Map((productRows || []).map((p: any) => [String(p.id), Number(p.price_cost) || 0]));
        totalCost = items.reduce((acc, item) => {
            const qty = Number(item.quantity) || 0;
            const cost = costMap.get(String(item.product_id || '')) || 0;
            return acc + (cost * qty);
        }, 0);
    }

    return {
        totalCost,
        totalSale,
        profit: totalSale - totalCost,
    };
}

async function notifyPaidOrderTelegram(order: any, items: any[]) {
    const financial = await calculateOrderCostAndProfit(items, Number(order.total) || 0);
    const itemsText = (items || []).map((i: any) => {
        const subtotal = Number(i.subtotal) || ((Number(i.unit_price) || 0) * (Number(i.quantity) || 0));
        return `• ${i.product_name || 'Item'} x${i.quantity || 0} — ${formatCurrency(subtotal)}`;
    }).join('\n');

    telegramBotService.notifyOnlineOrderPaid({
        id_pedido: String(order.id || '').slice(0, 8),
        id_pedido_completo: String(order.id || '-'),
        cliente: order.customer_name || '-',
        telefone: order.customer_phone || '-',
        email: order.customer_email || '-',
        itens: itemsText || 'Sem itens detalhados',
        preco_compra: formatCurrency(financial.totalCost),
        preco_venda: formatCurrency(financial.totalSale),
        lucro: formatCurrency(financial.profit),
        pagamento: getPaymentLabel(order.payment_method),
        entrega: getDeliveryLabel(order.delivery_type),
        endereco: getAddressLabel(order.shipping_address),
        data_pagamento: new Date().toLocaleString('pt-BR'),
    });
}

async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', COMPANY_SLUG)
        .single();
    if (error || !data) throw new Error('Empresa não encontrada.');
    return data.id;
}

// ─── Helper: auto-reserva de unidades serializadas ───────────────────────────
/**
 * Para cada item do pedido, verifica se o produto possui unidades serializadas
 * disponíveis e reserva automaticamente a mais antiga (FIFO).
 *
 * Falhas de reserva são logadas, mas nunca bloqueiam o fluxo de pagamento
 * (evitar perder vendas por inconsistência de estoque serializado).
 *
 * @param items  - Array de { product_id, quantity } dos itens do pedido
 * @param orderId - UUID do pedido para vincular na unidade reservada
 */
async function autoReserveOrderItems(
    items: Array<{ product_id: string; quantity: number }>,
    orderId: string
): Promise<void> {
    for (const item of items) {
        if (!item.product_id) continue;

        // Para cada unidade do item (um celular qty=2 reserva 2 unidades)
        for (let i = 0; i < item.quantity; i++) {
            try {
                await unitService.autoReserve(item.product_id, orderId);
                console.log(`[orderService] Unidade reservada para produto ${item.product_id} (pedido ${orderId})`);
            } catch (err: any) {
                // Produto sem unidades cadastradas ou sem disponível — não é erro fatal
                // (produtos não-serializados não têm unidades)
                if (!err.message?.includes('Nenhuma unidade disponível')) {
                    console.error(`[orderService] Falha inesperada ao reservar unidade para ${item.product_id}:`, err.message);
                }
                // Se não há unidade disponível, simplesmente ignora (produto não serializado)
                break; // Não tenta reservar mais unidades deste produto
            }
        }
    }
}

/**
 * Libera todas as unidades reservadas para um pedido, voltando para 'available'.
 * Chamado ao cancelar pedido. Units moram na VPS MySQL.
 */
async function releaseOrderUnits(orderId: string): Promise<void> {
    try {
        const { vpsApiService } = await import('./vpsApiService');
        const reserved = await vpsApiService.getUnitsByOrder(orderId);
        for (const u of (reserved || []).filter((x: any) => x.status === UnitStatus.RESERVED)) {
            await unitService.release(u.id);
        }
    } catch (err) {
        console.error(`[orderService] Falha ao liberar unidades do pedido ${orderId}:`, err);
    }
}

/**
 * Marca todas as units reservadas de um pedido como vendidas. Disparado
 * quando o pedido vira "completed" (entregue/concluído).
 */
async function markOrderUnitsAsSold(orderId: string): Promise<void> {
    try {
        const { vpsApiService } = await import('./vpsApiService');
        const units = await vpsApiService.getUnitsByOrder(orderId);
        for (const u of (units || []).filter((x: any) => x.status === UnitStatus.RESERVED)) {
            await unitService.markAsSold(u.id, orderId);
        }
    } catch (err) {
        console.error(`[orderService] Falha ao marcar unidades como sold (pedido ${orderId}):`, err);
    }
}

type OrderStockItem = {
    product_id?: string | null;
    quantity?: number | null;
};

function shouldFallbackToLegacyOrderStock(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String((error as any)?.message || error || '');
    const lowerMessage = message.toLowerCase();

    return [
        'decrement_product_stock_by_priority',
        'reserve_product_stock_by_priority',
        'consume_order_stock_reservations',
        'release_order_stock_reservations',
        'order_reservations_not_found',
        'restore_product_stock_from_order_movements',
        'order_location_movements_not_found',
        'could not find the function',
        'function',
        'does not exist',
        'schema cache',
        'pgrst202',
        'stock_deposits',
        'stock_locations',
        'product_stock_locations',
        'stock_location_movements',
    ].some(fragment => lowerMessage.includes(fragment));
}

async function decrementOrderItemStockByPriority(item: OrderStockItem, orderId: string): Promise<void> {
    if (!item.product_id) return;

    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) return;

    try {
        await stockLocationService.decrementStockByPriority({
            product_id: item.product_id,
            quantity,
            reason: `Pedido online #${orderId}`,
            reference_type: 'order',
            reference_id: orderId,
            notes: 'Baixa automatica de pedido online por prioridade de deposito.',
        });
        return;
    } catch (priorityError) {
        if (!shouldFallbackToLegacyOrderStock(priorityError)) {
            console.error(`[orderService] Falha na baixa por prioridade do produto ${item.product_id}:`, priorityError);
            return;
        }

        console.warn(
            `[orderService] Baixa por prioridade indisponivel; usando decrement_stock legado para produto ${item.product_id}.`,
            priorityError
        );
    }

    const { error: stockError } = await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_quantity: quantity,
    });
    if (stockError) {
        console.error(`[orderService] Falha ao deduzir estoque do produto ${item.product_id}:`, stockError);
    }
}

async function reserveOrderStockByPriority(orderId: string, items: OrderStockItem[] | null | undefined): Promise<boolean> {
    if (!items?.length) return true;

    for (const item of items) {
        if (!item.product_id) continue;

        const quantity = Number(item.quantity) || 0;
        if (quantity <= 0) continue;

        try {
            await stockLocationService.reserveStockByPriority({
                product_id: item.product_id,
                quantity,
                reason: `Reserva pedido online #${orderId}`,
                reference_type: 'order_reservation',
                reference_id: orderId,
                notes: 'Reserva automatica de pedido online por prioridade de deposito.',
            });
        } catch (reservationError) {
            if (shouldFallbackToLegacyOrderStock(reservationError)) {
                console.warn(
                    `[orderService] Reserva por prioridade indisponivel; seguindo sem reserva local para pedido ${orderId}.`,
                    reservationError
                );
                return false;
            }

            console.error(`[orderService] Falha na reserva por prioridade do pedido ${orderId}:`, reservationError);
            throw reservationError;
        }
    }

    return true;
}

async function consumeOrderReservedStock(orderId: string): Promise<boolean> {
    try {
        await stockLocationService.consumeOrderStockReservations({
            order_id: orderId,
            reason: `Baixa de reserva pedido online #${orderId}`,
            notes: 'Baixa automatica consumindo reserva do pedido online.',
        });
        return true;
    } catch (consumeError) {
        if (!shouldFallbackToLegacyOrderStock(consumeError)) {
            console.error(`[orderService] Falha ao consumir reserva do pedido ${orderId}:`, consumeError);
            return false;
        }

        console.warn(
            `[orderService] Consumo de reserva indisponivel; usando baixa por prioridade/fallback para pedido ${orderId}.`,
            consumeError
        );
        return false;
    }
}

async function finalizeOrderStockByPriority(items: OrderStockItem[] | null | undefined, orderId: string): Promise<void> {
    const consumedReservation = await consumeOrderReservedStock(orderId);
    if (consumedReservation) return;

    if (!items) return;

    for (const item of items) {
        await decrementOrderItemStockByPriority(item, orderId);
    }
}

async function releaseOrderReservedStock(orderId: string): Promise<void> {
    try {
        await stockLocationService.releaseOrderStockReservations({
            order_id: orderId,
            reason: `Liberacao reserva pedido online #${orderId}`,
            notes: 'Liberacao automatica de reserva pelo cancelamento do pedido online.',
        });
    } catch (releaseError) {
        if (!shouldFallbackToLegacyOrderStock(releaseError)) {
            console.error(`[orderService] Falha ao liberar reserva do pedido ${orderId}:`, releaseError);
            return;
        }

        console.warn(
            `[orderService] Liberacao de reserva indisponivel ou sem historico para pedido ${orderId}.`,
            releaseError
        );
    }
}

async function syncOrderItemsStockToBling(items: any[] | null | undefined, notes: string): Promise<void> {
    for (const item of items || []) {
        if (!item?.product_id || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) continue;

        await syncStockToBling(
            item.product_id,
            Number(item.quantity),
            notes,
            { comboSelections: item.combo_selections || item.comboSelections }
        );
    }
}

function orderHadNumericStockDecrement(order: { status?: string | null; payment_status?: string | null } | null | undefined): boolean {
    if (!order || order.status === 'cancelled') return false;

    return order.payment_status === 'paid' || [
        'paid',
        'preparing',
        'shipped',
        'delivered',
        'completed',
    ].includes(String(order.status || ''));
}

async function restoreOrderStockForItems(orderId: string, items: OrderStockItem[] | null | undefined, reason: string): Promise<void> {
    try {
        await stockLocationService.restoreOrderStockByLocation({
            order_id: orderId,
            reason,
            notes: 'Devolucao automatica pelo cancelamento de pedido online.',
        });
        return;
    } catch (restoreError) {
        if (!shouldFallbackToLegacyOrderStock(restoreError)) {
            console.error(`[orderService] Falha ao restaurar estoque por local do pedido ${orderId}:`, restoreError);
            return;
        }

        console.warn(
            `[orderService] Restauracao por local indisponivel; usando increment_stock legado para pedido ${orderId}.`,
            restoreError
        );
    }

    if (!items) return;

    for (const item of items) {
        if (!item.product_id) continue;

        const quantity = Number(item.quantity) || 0;
        if (quantity <= 0) continue;

        const { error: stockError } = await supabase.rpc('increment_stock', {
            p_product_id: item.product_id,
            p_quantity: quantity,
        });

        if (stockError) {
            console.error(`[orderService] Falha ao restaurar estoque do produto ${item.product_id}:`, stockError);
        }
    }
}



// ─── Criar pedido ─────────────────────────────────────────────────────────────

export async function createOrder(input: OrderInput): Promise<Order> {
    const companyId = await getCompanyId();
    const cardFormData = (input as any).card_form_data;

    const subtotal = input.items.reduce((sum, item) => sum + item.subtotal, 0);
    const couponDisc = input.coupon_discount ?? 0;
    const coinsDisc = input.coins_discount ?? 0;
    const totalDiscount = couponDisc + coinsDisc;
    const total = subtotal - totalDiscount + input.shipping_cost;

    const orderData = {
        company_id: companyId,
        customer_id: input.customer_id ?? null,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_email: input.customer_email ?? null,
        status: 'pending' as OrderStatus,
        payment_status: 'pending' as OrderPaymentStatus,
        payment_method: input.payment_method,
        payment_gateway: input.payment_gateway ?? null,
        delivery_type: input.delivery_type,
        shipping_address: input.shipping_address ?? null,
        shipping_cost: input.shipping_cost,
        shipping_origin_cep: (input as any).shipping_origin_cep ?? null,
        shipping_origin_label: (input as any).shipping_origin_label ?? null,
        subtotal,
        discount: totalDiscount,
        total,
        coupon_code: input.coupon_code ?? null,
        coupon_discount: couponDisc,
        coins_spent: input.coins_spent ?? 0,
        coins_discount: coinsDisc,
        referral_code: input.referral_code ?? null,
        referral_name: input.referral_name ?? null,
        notes: input.notes ?? null,
    };


    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error('Falha ao criar pedido.');

    // Adiciona moedas pendentes (aguardando conf. de pagamento)
    if (orderData.customer_id) {
        // Moedas calculadas apenas sobre o valor dos produtos (excluindo frete)
        const productTotalReais = (orderData.subtotal - orderData.discount) / 100;
        addPendingCoinsForPurchase(orderData.customer_id, productTotalReais, order.id).catch(e => console.error("Erro ao emitir moedas pendentes:", e));
    }

    // Insere os itens
    const items = input.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku ?? null,
        product_image_url: item.product_image_url ?? null,
        product_color: item.product_color ?? null,
        combo_selections: item.comboSelections ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(items);

    if (itemsError) {
        // Rollback: remove o pedido se os itens falharem
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(itemsError.message);
    }

    try {
        await reserveOrderStockByPriority(order.id, input.items);
    } catch (reservationError: any) {
        await releaseOrderReservedStock(order.id);
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(reservationError?.message || 'Falha ao reservar estoque do pedido.');
    }

    // ─── GATEWAY INTEGRATION BLOCK ──────────────────────────────────────────
    if (orderData.payment_gateway === 'mercado_pago' && orderData.payment_method === 'pix') {
        try {
            // 1. Busca Token de Produção/Sandbox do Banco
            const credentials = await paymentIntegrationService.getIntegrationByGateway('mercado_pago');
            if (!credentials || !credentials.is_active || !credentials.access_token) {
                throw new Error("Credenciais do Mercado Pago não configuradas no painel.");
            }

            // 2. Dispara requisição para a API REST do Mercado Pago local
            const mpResponse = await mercadoPagoProvider.createPixPayment(input, credentials.access_token);

            // 3. Verifica dados PIX gerados
            const qrCode = mpResponse.point_of_interaction?.transaction_data?.qr_code;
            const qrCode64 = mpResponse.point_of_interaction?.transaction_data?.qr_code_base64;
            const ticketUrl = mpResponse.point_of_interaction?.transaction_data?.ticket_url;

            if (qrCode && qrCode64) {
                // Montar JSONB para a coluna `gateway_pix_data` e colocar o ID dele `gateway_payment_id`
                const pixData = {
                    qr_code: qrCode,
                    qr_code_base64: qrCode64,
                    ticket_url: ticketUrl
                };

                const { error: updateOrderError } = await supabase
                    .from('orders')
                    .update({
                        gateway_payment_id: String(mpResponse.id),
                        gateway_pix_data: pixData,
                        status: 'awaiting_payment'
                    })
                    .eq('id', order.id);

                if (!updateOrderError) {
                    // Modifica objeto em menória para retorno rápido pro front
                    (order as any).gateway_pix_data = pixData;
                    (order as any).status = 'awaiting_payment';
                }
            }
        } catch (mpError: any) {
            console.error("Falha ao gerar Pix MP:", mpError);
            // Marca pedido como payment_failed para preservar histórico (não deleta)
            await supabase
                .from('orders')
                .update({ status: 'payment_failed', payment_status: 'failed' })
                .eq('id', order.id);
            await releaseOrderReservedStock(order.id);
            throw new Error(mpError.message || "Erro ao gerar cobrança PIX. Tente novamente.");
        }
    } else if (orderData.payment_gateway === 'mercado_pago' && orderData.payment_method === 'credit_card') {
        try {
            const credentials = await paymentIntegrationService.getIntegrationByGateway('mercado_pago');
            if (!credentials || !credentials.is_active || !credentials.access_token) {
                throw new Error("Credenciais do Mercado Pago não configuradas no painel.");
            }

            // Verifica se veio um token do Brick (checkout transparente)

            if (cardFormData?.token) {
                // ── Checkout Transparente (Brick) ──
                const mpResponse = await mercadoPagoProvider.createCardPayment(input, cardFormData, credentials.access_token);

                const { error: updateErr } = await supabase
                    .from('orders')
                    .update({
                        gateway_payment_id: String(mpResponse.id),
                        status: mpResponse.status === 'approved' ? 'paid' : 'awaiting_payment',
                        payment_status: mpResponse.status === 'approved' ? 'paid' : 'pending',
                    })
                    .eq('id', order.id);

                if (!updateErr) {
                    (order as any).gateway_payment_status = mpResponse.status;
                    (order as any).status = mpResponse.status === 'approved' ? 'paid' : 'awaiting_payment';

                    if (mpResponse.status === 'approved') {
                        confirmPendingCoins(order.id).catch(console.error);
                        await finalizeOrderStockByPriority(input.items, order.id);
                        syncOrderItemsStockToBling(
                            input.items,
                            `Pedido online #${order.id} — Mercado do Vale`
                        ).catch(e => console.error('[orderService] Falha ao sincronizar estoque Bling (card approved):', e));
                        // Auto-reserva de unidades serializadas (cartão aprovado na hora)
                        autoReserveOrderItems(input.items, order.id).catch(e =>
                            console.error('[orderService] Falha na reserva serializada (card approved):', e)
                        );
                    }
                }
                if (mpResponse.status === 'rejected') {
                    await supabase
                        .from('orders')
                        .update({ status: 'payment_failed', payment_status: 'failed' })
                        .eq('id', order.id);
                    const MP_REJECTION_MESSAGES: Record<string, string> = {
                        cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão. Tente outro cartão.',
                        cc_rejected_bad_filled_security_code: 'CVV incorreto. Verifique o código de segurança.',
                        cc_rejected_bad_filled_date: 'Data de validade incorreta. Verifique e tente novamente.',
                        cc_rejected_bad_filled_other: 'Dados do cartão incorretos. Verifique e tente novamente.',
                        cc_rejected_max_attempts: 'Muitas tentativas recusadas. Tente novamente mais tarde ou use outro cartão.',
                        cc_rejected_call_for_authorize: 'Pagamento não autorizado. Entre em contato com seu banco para liberar a compra.',
                        cc_rejected_duplicated_payment: 'Este pagamento já foi processado anteriormente.',
                        cc_rejected_invalid_installments: 'Número de parcelas não aceito para este cartão.',
                        cc_rejected_high_risk: 'Pagamento recusado por segurança. Tente outro cartão ou forma de pagamento.',
                        cc_rejected_card_disabled: 'Cartão bloqueado ou inativo. Entre em contato com seu banco.',
                        cc_rejected_other_reason: 'Pagamento recusado pelo banco. Tente outro cartão ou entre em contato com seu banco.',
                        pending_contingency: 'Pagamento em análise. Aguarde a confirmação.',
                        pending_review_manual: 'Pagamento em revisão manual. Entraremos em contato em breve.',
                    };
                    const friendlyMessage = MP_REJECTION_MESSAGES[mpResponse.status_detail]
                        ?? `Pagamento recusado. Motivo: ${mpResponse.status_detail}`;
                    throw new Error(friendlyMessage);
                }
            } else {
                // ── Fallback: Checkout PRO (redirect) ──
                const mpResponse = await mercadoPagoProvider.createPreference(input, credentials.access_token, order.id);
                const initPoint = credentials.environment === 'production'
                    ? mpResponse.init_point
                    : mpResponse.sandbox_init_point;

                if (initPoint) {
                    await supabase
                        .from('orders')
                        .update({ gateway_payment_id: String(mpResponse.id), gateway_payment_url: initPoint, status: 'awaiting_payment' })
                        .eq('id', order.id);
                    (order as any).gateway_payment_url = initPoint;
                    (order as any).status = 'awaiting_payment';
                }
            }
        } catch (mpError: any) {
            console.error("Falha no pagamento MP:", mpError);
            await supabase
                .from('orders')
                .update({ status: 'payment_failed', payment_status: 'failed' })
                .eq('id', order.id);
            await releaseOrderReservedStock(order.id);
            throw new Error(mpError.message || "Erro de integração com o Mercado Pago.");
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    return order as Order;
}

// ─── Buscar pedido por ID ─────────────────────────────────────────────────────

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !order) return null;

    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id);

    return { ...order, items: items || [] } as OrderWithItems;
}

// ─── Listar pedidos (painel admin) ────────────────────────────────────────────

export async function getOrders(filters?: OrderFilters): Promise<OrderWithItems[]> {
    let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.payment_status) query = query.eq('payment_status', filters.payment_status);
    if (filters?.payment_method) query = query.eq('payment_method', filters.payment_method);
    if (filters?.delivery_type) query = query.eq('delivery_type', filters.delivery_type);
    if (filters?.start_date) query = query.gte('created_at', filters.start_date);
    if (filters?.end_date) query = query.lte('created_at', filters.end_date);
    if (filters?.search) {
        query = query.or(
            `customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`
        );
    }

    const { data: orders, error } = await query;
    if (error) throw new Error(error.message);
    if (!orders?.length) return [];

    // Busca itens de todos os pedidos em paralelo
    const withItems = await Promise.all(
        orders.map(async (order) => {
            const { data: items } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', order.id);
            return { ...order, items: items || [] } as OrderWithItems;
        })
    );

    return withItems;
}

// ─── Atualizar status (admin) ─────────────────────────────────────────────────

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
    if (error) throw new Error(error.message);
    if (status === 'completed') {
        markOrderUnitsAsSold(id).catch(e =>
            console.error('[orderService] Falha ao baixar units (updateOrderStatus completed):', e)
        );
    }
}

// ─── Confirmar pagamento (via webhook do gateway) ─────────────────────────────

export async function confirmPayment(
    gatewayPaymentId: string,
    result: Partial<GatewayPaymentResult>
): Promise<void> {
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, status, payment_status, subtotal, discount, total, customer_phone, customer_email, payment_method, delivery_type, shipping_address, referral_code, customer_id, customer_name, items:order_items(product_id, product_name, quantity, unit_price, subtotal, combo_selections)')
        .eq('gateway_payment_id', gatewayPaymentId)
        .single();

    if (fetchError || !order) throw new Error('Pedido não encontrado para este pagamento.');
    const alreadyHadStockDecrement = orderHadNumericStockDecrement(order);

    // Atualiza status do pedido
    const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_status: 'paid' })
        .eq('id', order.id);

    if (updateError) throw new Error(updateError.message);
    if (alreadyHadStockDecrement) return;

    // Confirma moedas pendentes
    confirmPendingCoins(order.id).catch(e => console.error("Erro confirmando moedas:", e));

    // Processa recompensa de indicação (se houver)
    if (order.referral_code && order.customer_id) {
        const productTotalReais = (order.subtotal - order.discount) / 100;
        supabase.rpc('process_referral_reward', {
            p_referral_code: order.referral_code,
            p_buyer_id: order.customer_id,
            p_purchase_value: productTotalReais,
            p_reference_id: order.id,
            p_reference_type: 'order',
            p_buyer_name: order.customer_name
        }).then(({ error, data }) => {
            if (error) console.error("Erro na RPC de indicação:", error);
            else console.log("Resultado da indicação:", data);
        });
    }

    const items = (order as any).items || [];

    // Alerta em tempo real: somente quando o pedido foi pago.
    notifyPaidOrderTelegram(order, items).catch((e) =>
        console.error('[orderService] Falha no alerta Telegram de pedido pago:', e)
    );

    // Deduz estoque numérico dos itens, consumindo reserva quando existir
    await finalizeOrderStockByPriority(items, order.id);
    syncOrderItemsStockToBling(
        items,
        `Pedido online #${order.id} — Mercado do Vale`
    ).catch(e => console.error('[orderService] Falha ao sincronizar estoque Bling (confirmPayment):', e));

    // Auto-reserva de unidades serializadas (IMEI/Serial) — FIFO
    // Roda após dedução de estoque, para qualquer produto que tenha unidades cadastradas
    autoReserveOrderItems(items, order.id).catch(e =>
        console.error('[orderService] Falha parcial na reserva serializada (confirmPayment):', e)
    );
}

// ─── Finalizar pedido com pagamento na entrega (admin) ───────────────────────

export async function completeOnDeliveryOrder(id: string): Promise<void> {
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, status, payment_status, subtotal, discount, total, customer_phone, customer_email, payment_method, delivery_type, shipping_address, referral_code, customer_id, customer_name, items:order_items(product_id, product_name, quantity, unit_price, subtotal, combo_selections)')
        .eq('id', id)
        .single();

    if (fetchError || !order) throw new Error('Pedido não encontrado.');
    const alreadyHadStockDecrement = orderHadNumericStockDecrement(order);

    // Atualiza status
    const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed', payment_status: 'paid' })
        .eq('id', id);

    if (updateError) throw new Error(updateError.message);
    if (alreadyHadStockDecrement) return;

    // Confirma moedas pendentes
    confirmPendingCoins(id).catch(e => console.error("Erro confirmando moedas entregues:", e));

    // Processa recompensa de indicação (se houver)
    if (order.referral_code && order.customer_id) {
        const productTotalReais = (order.subtotal - order.discount) / 100;
        supabase.rpc('process_referral_reward', {
            p_referral_code: order.referral_code,
            p_buyer_id: order.customer_id,
            p_purchase_value: productTotalReais,
            p_reference_id: order.id,
            p_reference_type: 'order',
            p_buyer_name: order.customer_name
        }).then(({ error, data }) => {
            if (error) console.error("Erro na RPC de indicação:", error);
            else console.log("Resultado da indicação:", data);
        });
    }

    // Deduz estoque numérico dos itens
    const items = (order as any).items || [];

    // Alerta em tempo real para pagamento confirmado na entrega/retirada.
    notifyPaidOrderTelegram(order, items).catch((e) =>
        console.error('[orderService] Falha no alerta Telegram de pedido pago na entrega:', e)
    );

    await finalizeOrderStockByPriority(items, id);
    syncOrderItemsStockToBling(
        items,
        `Pedido online #${id} — Mercado do Vale`
    ).catch(e => console.error('[orderService] Falha ao sincronizar estoque Bling (onDelivery):', e));

    // Auto-reserva de unidades serializadas (IMEI/Serial) — FIFO
    // Aguarda concluir antes de marcar como sold pra não perder units recém-reservadas.
    autoReserveOrderItems(items, id)
        .then(() => markOrderUnitsAsSold(id))
        .catch(e =>
            console.error('[orderService] Falha parcial na reserva/sold serializada (onDelivery):', e)
        );
}

// ─── Cancelar pedido ──────────────────────────────────────────────────────────

export async function cancelOrder(id: string): Promise<void> {
    const { data: orderBeforeCancel, error: orderFetchError } = await supabase
        .from('orders')
        .select('id, payment_status, status')
        .eq('id', id)
        .single();
    if (orderFetchError) throw new Error(orderFetchError.message);

    let items: OrderStockItem[] | null = null;
    const shouldRestoreNumericStock = orderHadNumericStockDecrement(orderBeforeCancel);

    if (shouldRestoreNumericStock) {
        const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select('product_id, quantity')
            .eq('order_id', id);
        if (itemsError) throw new Error(itemsError.message);
        items = orderItems || [];
    }

    const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', id);
    if (error) throw new Error(error.message);

    // Cancela moedas pendentes
    cancelPendingCoins(id).catch(e => console.error("Erro cancelando moedas pendentes:", e));

    // Estorna moedas de indicação (se existirem e já tiverem sido pagas)
    cancelReferralReward(id).catch(e => console.error("Erro cancelando moedas de indicação:", e));

    if (shouldRestoreNumericStock) {
        await restoreOrderStockForItems(id, items, `Cancelamento pedido online #${id}`);
    } else {
        await releaseOrderReservedStock(id);
    }

    // Libera unidades serializadas reservadas — voltam para 'available'
    releaseOrderUnits(id).catch(e =>
        console.error('[orderService] Falha ao liberar unidades serializadas (cancelOrder):', e)
    );
}

// ─── Salvar resultado do gateway no pedido ────────────────────────────────────

export async function saveGatewayResult(orderId: string, result: GatewayPaymentResult): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({
            gateway_payment_id: result.gateway_payment_id,
            gateway_payment_url: result.payment_url ?? null,
            status: 'awaiting_payment',
            payment_status: result.status,
        })
        .eq('id', orderId);
    if (error) throw new Error(error.message);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const orderService = {
    createOrder,
    getOrderById,
    getOrders,
    updateOrderStatus,
    confirmPayment,
    completeOnDeliveryOrder,
    cancelOrder,
    saveGatewayResult,
};
