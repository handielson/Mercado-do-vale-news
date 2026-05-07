import type { OrderInput } from '../../types/order';

interface MercadoPagoPixResponse {
    id: number;
    status: string;
    point_of_interaction?: {
        transaction_data?: {
            qr_code: string;
            qr_code_base64: string;
            ticket_url: string;
        }
    };
}

interface MercadoPagoPreferenceResponse {
    id: string;
    init_point: string;
    sandbox_init_point: string;
}

export interface MercadoPagoCardPaymentResponse {
    id: number;
    status: 'approved' | 'rejected' | 'pending' | 'in_process' | 'authorized';
    status_detail: string;
    currency_id: string;
    transaction_amount: number;
    payment_method_id: string;
    payment_type_id: string;
    installments: number;
}

export interface CardFormData {
    token: string;
    installments: number;
    paymentMethodId: string;
    issuerId: string;
    payer: {
        email: string;
        identification?: { type: string; number: string };
    };
}

export const mercadoPagoProvider = {
    /**
     * Gera uma cobrança PIX na API do Mercado Pago
     */
    async createPixPayment(
        orderData: OrderInput,
        accessToken: string
    ): Promise<MercadoPagoPixResponse> {
        const email = orderData.customer_email || 'cliente@mercadodovale.com.br';
        const firstName = orderData.customer_name.split(' ')[0] || 'Cliente';
        const lastName = orderData.customer_name.split(' ').slice(1).join(' ') || 'Não Informado';

        const totalCentavos = orderData.items.reduce((sum, item) => sum + item.subtotal, 0)
            + (orderData.shipping_cost || 0)
            - (orderData.coupon_discount || 0);

        const cpfDigits = (orderData.customer_document || '').replace(/\D/g, '');
        const identification = cpfDigits.length === 11
            ? { type: 'CPF', number: cpfDigits }
            : cpfDigits.length === 14
                ? { type: 'CNPJ', number: cpfDigits }
                : undefined;

        const payer: Record<string, unknown> = { email, first_name: firstName, last_name: lastName };
        if (identification) payer.identification = identification;

        const notificationUrl = typeof window !== 'undefined' && window.location?.origin
            ? `${window.location.origin}/api/mercadopago-webhook`
            : undefined;

        const payload: Record<string, unknown> = {
            transaction_amount: Number((totalCentavos / 100).toFixed(2)),
            description: `Pedido Mercado do Vale - ${orderData.items.length} itens`,
            payment_method_id: 'pix',
            payer
        };
        if (notificationUrl) payload.notification_url = notificationUrl;

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': crypto.randomUUID()
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro Mercado Pago PIX:', { payload, errorData });
            const detail = errorData?.cause?.[0]?.description
                || errorData?.cause?.[0]?.code
                || errorData?.message
                || errorData?.error
                || response.statusText;
            throw new Error(`Falha ao gerar PIX Mercado Pago: ${detail}`);
        }

        return (await response.json()) as MercadoPagoPixResponse;
    },

    /**
     * Cobra cartão de crédito via token gerado pelo Brick (Checkout Transparente)
     */
    async createCardPayment(
        orderData: OrderInput,
        cardFormData: CardFormData,
        accessToken: string
    ): Promise<MercadoPagoCardPaymentResponse> {
        const totalCentavos = orderData.items.reduce((sum, item) => sum + item.subtotal, 0)
            + (orderData.shipping_cost || 0)
            - (orderData.coupon_discount || 0);

        const payload = {
            token: cardFormData.token,
            transaction_amount: Number((totalCentavos / 100).toFixed(2)),
            installments: cardFormData.installments || 1,
            payment_method_id: cardFormData.paymentMethodId,
            issuer_id: cardFormData.issuerId ? Number(cardFormData.issuerId) : undefined,
            description: `Pedido Mercado do Vale - ${orderData.items.length} itens`,
            statement_descriptor: 'MERCADO DO VALE',
            payer: {
                email: cardFormData.payer?.email || orderData.customer_email || 'cliente@mercadodovale.com.br',
                identification: cardFormData.payer?.identification,
            },
        };

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro MP Card Payment:', errorData);
            const detail = errorData?.cause?.[0]?.description || errorData.message || response.statusText;
            throw new Error(`Pagamento recusado: ${detail}`);
        }

        return (await response.json()) as MercadoPagoCardPaymentResponse;
    },

    /**
     * Gera uma URL de Checkout Pro (Preferences) — mantido como fallback
     */
    async createPreference(
        orderData: OrderInput,
        accessToken: string,
        orderId: string
    ): Promise<MercadoPagoPreferenceResponse> {
        const cleanPhone = orderData.customer_phone.replace(/\D/g, '');

        const items = orderData.items.map(item => ({
            id: item.product_id,
            title: item.product_name,
            description: item.product_sku || 'Produto E-commerce',
            quantity: item.quantity,
            currency_id: 'BRL',
            unit_price: Number((item.unit_price / 100).toFixed(2))
        }));

        if (orderData.shipping_cost > 0) {
            items.push({
                id: 'shipping',
                title: 'Custo de Frete',
                description: 'Entrega do pedido',
                quantity: 1,
                currency_id: 'BRL',
                unit_price: Number((orderData.shipping_cost / 100).toFixed(2))
            });
        }

        const payload = {
            items,
            payer: {
                name: orderData.customer_name.split(' ')[0] || 'Cliente',
                surname: orderData.customer_name.split(' ').slice(1).join(' ') || '',
                email: orderData.customer_email || 'cliente@mercadodovale.com.br',
                phone: {
                    area_code: cleanPhone.substring(0, 2),
                    number: cleanPhone.substring(2)
                }
            },
            external_reference: orderId,
            payment_methods: {
                excluded_payment_types: [{ id: 'ticket' }],
                installments: 12
            }
        };

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro MP Preference:', errorData);
            throw new Error(`Falha ao gerar URL de Checkout MP: ${errorData.message || response.statusText}`);
        }

        return (await response.json()) as MercadoPagoPreferenceResponse;
    }
};
