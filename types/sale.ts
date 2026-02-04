/**
 * Sale Types
 * Types for POS (Point of Sale) system
 */

/**
 * Payment Methods
 */
export type PaymentMethodType = 'money' | 'credit' | 'debit' | 'pix';

export interface PaymentMethod {
    method: PaymentMethodType;
    amount: number; // Valor BASE em centavos (sem taxa)
    installments?: number; // Número de parcelas (apenas para credit)
    fee_percentage?: number; // Taxa aplicada (%)
    fee_amount?: number; // Valor da taxa em centavos
    total_with_fee: number; // Valor total (amount + fee_amount)
}

/**
 * Delivery Types
 */
export type DeliveryType = 'store_pickup' | 'store_delivery' | 'hybrid_delivery';

/**
 * Sale Item (Carrinho)
 */
export interface SaleItem {
    id: string; // UUID temporário para o carrinho (gerado no frontend)
    product_id: string;
    product_name: string;
    product_sku?: string;
    quantity: number;
    unit_price: number; // em centavos
    unit_cost: number; // em centavos (price_cost do produto)
    discount: number; // desconto por unidade em centavos
    subtotal: number; // unit_price * quantity
    total: number; // subtotal - (discount * quantity)
    is_gift: boolean;
    // Controle de estoque
    track_inventory: boolean; // Se o produto controla estoque
    stock_quantity?: number; // Quantidade em estoque
}

/**
 * Sale (Venda Completa)
 */
export interface Sale {
    id: string;
    customer_id: string; // OBRIGATÓRIO
    seller_id?: string;
    subtotal: number; // em centavos
    discount_total: number; // em centavos
    total: number; // em centavos
    cost_total: number; // em centavos
    profit: number; // em centavos
    payment_methods: PaymentMethod[];
    notes?: string;
    status: 'completed' | 'cancelled' | 'refunded';

    // Delivery fields
    delivery_type?: DeliveryType;
    delivery_person_id?: string;
    delivery_cost_store?: number; // em centavos
    delivery_cost_customer?: number; // em centavos
    delivery_total?: number; // em centavos

    // Discount fields
    promotional_discount?: number; // em centavos

    created_at: string;
    updated_at: string;
}

/**
 * Sale Input (para criar venda)
 */
export interface SaleInput {
    customer_id: string; // OBRIGATÓRIO
    seller_id?: string;
    items: SaleItem[];
    payment_methods: PaymentMethod[];
    notes?: string;

    // Delivery fields
    delivery_type?: DeliveryType;
    delivery_person_id?: string;
    delivery_cost_store?: number; // em centavos
    delivery_cost_customer?: number; // em centavos
    delivery_total?: number; // em centavos

    // Discount fields
    promotional_discount?: number; // em centavos
}

/**
 * Sale with Items (para exibição)
 */
export interface SaleWithItems extends Sale {
    items: SaleItem[];
    customer?: {
        id: string;
        name: string;
        cpf_cnpj?: string;
    };
    seller?: {
        id: string;
        name: string;
    };
}

/**
 * Sale Filters (para listagem)
 */
export interface SaleFilters {
    customer_id?: string;
    seller_id?: string;
    status?: 'completed' | 'cancelled' | 'refunded';
    start_date?: string;
    end_date?: string;
    min_total?: number;
    max_total?: number;
}

/**
 * Sale Summary (para relatórios)
 */
export interface SaleSummary {
    total_sales: number;
    total_revenue: number; // em centavos
    total_profit: number; // em centavos
    total_cost: number; // em centavos
    average_ticket: number; // em centavos
    profit_margin: number; // percentual (0-100)
}

/**
 * Delivery Credit (créditos de entregador)
 */
export interface DeliveryCredit {
    id: string;
    delivery_person_id: string;
    sale_id: string;
    amount: number; // em centavos
    delivery_type: DeliveryType;
    status: 'pending' | 'paid' | 'cancelled';
    paid_at?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Delivery Person Earnings (resumo de ganhos)
 */
export interface DeliveryPersonEarnings {
    delivery_person_id: string;
    delivery_person_name: string;
    total_deliveries: number;
    total_earnings: number; // em centavos
    pending_earnings: number; // em centavos
    paid_earnings: number; // em centavos
}
