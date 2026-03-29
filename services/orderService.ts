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

async function getCompanyId(): Promise<string> {
    const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', COMPANY_SLUG)
        .single();
    if (error || !data) throw new Error('Empresa não encontrada.');
    return data.id;
}

// ─── Criar pedido ─────────────────────────────────────────────────────────────

export async function createOrder(input: OrderInput): Promise<Order> {
    const companyId = await getCompanyId();

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

    // Notifica Telegram imediatamente para pedidos on_delivery
    if (orderData.payment_method === 'on_delivery') {
        telegramBotService.notifyOnlineOrder(
            buildOrderNotificationData({ ...orderData, id: order.id }, input.items)
        );
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
            // Cancela o pedido e mostra o erro ao usuário
            await supabase.from('orders').delete().eq('id', order.id);
            throw new Error(mpError.message || "Erro ao gerar cobrança PIX. Tente novamente.");
        }
    } else if (orderData.payment_gateway === 'mercado_pago' && orderData.payment_method === 'credit_card') {
        try {
            const credentials = await paymentIntegrationService.getIntegrationByGateway('mercado_pago');
            if (!credentials || !credentials.is_active || !credentials.access_token) {
                throw new Error("Credenciais do Mercado Pago não configuradas no painel.");
            }

            // Verifica se veio um token do Brick (checkout transparente)
            const cardFormData = (input as any).card_form_data;

            if (cardFormData?.token) {
                // ── Checkout Transparente (Brick) ──
                const mpResponse = await mercadoPagoProvider.createCardPayment(input, cardFormData, credentials.access_token);

                const { error: updateErr } = await supabase
                    .from('orders')
                    .update({
                        gateway_payment_id: String(mpResponse.id),
                        status: mpResponse.status === 'approved' ? 'paid' : 'awaiting_payment',
                    })
                    .eq('id', order.id);

                if (!updateErr) {
                    (order as any).gateway_payment_status = mpResponse.status;
                    (order as any).status = mpResponse.status === 'approved' ? 'paid' : 'awaiting_payment';

                    if (mpResponse.status === 'approved') {
                        confirmPendingCoins(order.id).catch(console.error);
                    }
                }

                // Notifica Telegram se cartão aprovado imediatamente
                if (mpResponse.status === 'approved') {
                    telegramBotService.notifyOnlineOrder(
                        buildOrderNotificationData({ ...orderData, id: order.id }, input.items, {
                            installments: cardFormData.installments ?? 1,
                            cardBrand: cardFormData.payment_method_id,
                        })
                    );
                }

                if (mpResponse.status === 'rejected') {
                    await supabase.from('orders').delete().eq('id', order.id);
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
            await supabase.from('orders').delete().eq('id', order.id);
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
}

// ─── Confirmar pagamento (via webhook do gateway) ─────────────────────────────

export async function confirmPayment(
    gatewayPaymentId: string,
    result: Partial<GatewayPaymentResult>
): Promise<void> {
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, subtotal, discount, referral_code, customer_id, customer_name, items:order_items(product_id, quantity)')
        .eq('gateway_payment_id', gatewayPaymentId)
        .single();

    if (fetchError || !order) throw new Error('Pedido não encontrado para este pagamento.');

    // Atualiza status do pedido
    const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid', payment_status: 'paid' })
        .eq('id', order.id);

    if (updateError) throw new Error(updateError.message);

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

    // Notifica Telegram: pagamento online confirmado (PIX/webhook)
    const items = (order as any).items || [];
    telegramBotService.notifyOnlineOrder(
        buildOrderNotificationData({ ...order, status: 'paid' }, items)
    );

    // Deduz estoque dos itens
    for (const item of items) {
        if (!item.product_id) continue;
        const { error: stockError } = await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
        });
        if (stockError) {
            console.error(`[orderService] Falha ao deduzir estoque do produto ${item.product_id}:`, stockError);
        }
    }
}

// ─── Finalizar pedido com pagamento na entrega (admin) ───────────────────────

export async function completeOnDeliveryOrder(id: string): Promise<void> {
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('id, subtotal, discount, referral_code, customer_id, customer_name, items:order_items(product_id, quantity)')
        .eq('id', id)
        .single();

    if (fetchError || !order) throw new Error('Pedido não encontrado.');

    // Atualiza status
    const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'completed', payment_status: 'paid' })
        .eq('id', id);

    if (updateError) throw new Error(updateError.message);

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

    // Deduz estoque
    const items = (order as any).items || [];
    for (const item of items) {
        if (!item.product_id) continue;
        const { error: stockError } = await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_quantity: item.quantity,
        });
        if (stockError) {
            console.error(`[orderService] Falha ao deduzir estoque:`, stockError);
        }
    }
}

// ─── Cancelar pedido ──────────────────────────────────────────────────────────

export async function cancelOrder(id: string): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', id);
    if (error) throw new Error(error.message);

    // Cancela moedas pendentes
    cancelPendingCoins(id).catch(e => console.error("Erro cancelando moedas pendentes:", e));

    // Estorna moedas de indicação (se existirem e já tiverem sido pagas)
    cancelReferralReward(id).catch(e => console.error("Erro cancelando moedas de indicação:", e));
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
