/**
 * Order Types — Pedidos Online (E-commerce)
 * Separado de Sale (PDV) pois tem status intermediários e dados de cliente anônimo.
 * Valores monetários sempre em centavos (seguindo padrão do projeto).
 */

// ─── Status ──────────────────────────────────────────────────────────────────

export type OrderStatus =
    | 'pending'           // Aguardando pagamento/confirmação
    | 'awaiting_payment'  // Pagamento iniciado no gateway (PIX gerado, etc.)
    | 'payment_failed'    // Pagamento não concluído / recusado
    | 'paid'              // Pagamento confirmado pelo gateway (webhook)
    | 'preparing'         // Em preparação / separação
    | 'shipped'           // Enviado / saiu para entrega
    | 'delivered'         // Entregue ao cliente
    | 'completed'         // Concluído (pagamento na entrega + admin finalizou)
    | 'cancelled';        // Cancelado

export type OrderPaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'on_delivery';

export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type OrderDeliveryType = 'pickup' | 'delivery';

// ─── Gateway ─────────────────────────────────────────────────────────────────

export type PaymentGateway = 'mercado_pago' | 'pagseguro' | 'stripe' | 'pagaleve';

// ─── Endereço de Entrega ─────────────────────────────────────────────────────

export interface OrderShippingAddress {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
}

// ─── Item do Pedido ──────────────────────────────────────────────────────────

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    product_sku?: string;
    product_image_url?: string;  // URL da primeira imagem do produto
    product_color?: string;      // Cor/variante do produto
    quantity: number;
    unit_price: number;  // em centavos
    subtotal: number;    // em centavos
    created_at: string;
}

export interface OrderItemInput {
    product_id: string;
    product_name: string;
    product_sku?: string;
    product_image_url?: string;  // URL da primeira imagem
    product_color?: string;      // Cor/variante
    quantity: number;
    unit_price: number;  // em centavos
    subtotal: number;    // em centavos
}

// ─── Pedido ──────────────────────────────────────────────────────────────────

export interface Order {
    id: string;
    company_id: string;

    // Dados do cliente (pode ser anônimo)
    customer_id?: string;             // null se compra anônima
    customer_name: string;
    customer_phone: string;
    customer_email?: string;

    // Status
    status: OrderStatus;
    payment_status: OrderPaymentStatus;

    // Pagamento
    payment_method: OrderPaymentMethod;
    payment_gateway?: PaymentGateway;
    gateway_payment_id?: string;      // ID da transação no gateway
    gateway_payment_url?: string;     // URL de pagamento (Mercado Pago, etc.)
    gateway_pix_data?: {              // Dados para rendenizar o PIX
        qr_code: string;
        qr_code_base64: string;
        ticket_url?: string;
    };

    // Entrega
    delivery_type: OrderDeliveryType;
    shipping_address?: OrderShippingAddress;  // null se pickup
    shipping_cost: number;            // em centavos

    // Valores
    subtotal: number;                 // em centavos
    discount: number;                 // em centavos (cupom, etc.)
    total: number;                    // em centavos

    // Cupom
    coupon_code?: string;
    coupon_discount?: number;         // em centavos

    // Cashback
    coins_spent?: number;             // quantidade de moedas
    coins_discount?: number;          // em centavos

    // Referral
    referral_code?: string;
    referral_name?: string;

    notes?: string;
    created_at: string;
    updated_at: string;
}

// ─── Input para criar pedido ─────────────────────────────────────────────────

export interface OrderInput {
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    customer_id?: string;

    items: OrderItemInput[];

    payment_method: OrderPaymentMethod;
    payment_gateway?: PaymentGateway;

    delivery_type: OrderDeliveryType;
    shipping_address?: OrderShippingAddress;
    shipping_cost: number;            // em centavos

    coupon_code?: string;
    coupon_discount?: number;         // em centavos
    coins_spent?: number;
    coins_discount?: number;

    referral_code?: string;
    referral_name?: string;

    notes?: string;
}

// ─── Linha completa (com itens) ──────────────────────────────────────────────

export interface OrderWithItems extends Order {
    items: OrderItem[];
}

// ─── Filtros (painel admin) ──────────────────────────────────────────────────

export interface OrderFilters {
    status?: OrderStatus;
    payment_status?: OrderPaymentStatus;
    payment_method?: OrderPaymentMethod;
    delivery_type?: OrderDeliveryType;
    start_date?: string;
    end_date?: string;
    search?: string;  // nome ou telefone do cliente
    customer_id?: string;
}

// ─── Resultado de pagamento do gateway ──────────────────────────────────────

export interface GatewayPaymentResult {
    gateway_payment_id: string;
    payment_url?: string;       // URL de checkout (Mercado Pago, PagSeguro)
    pix_qr_code?: string;       // QR code PIX em base64
    pix_copy_paste?: string;    // Código copia-e-cola PIX
    status: OrderPaymentStatus;
}
