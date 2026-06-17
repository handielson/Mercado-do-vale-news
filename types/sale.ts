/**
 * Sale Types
 * Types for POS (Point of Sale) system
 */

/**
 * Payment Methods
 */
export type PaymentMethodType = 'money' | 'credit' | 'debit' | 'pix' | 'a_prazo';

export interface PaymentMethod {
    method: PaymentMethodType;
    amount: number; // Valor BASE em centavos (sem taxa)
    installments?: number; // Número de parcelas (apenas para credit)
    fee_percentage?: number; // Taxa aplicada (%)
    fee_amount?: number; // Valor da taxa em centavos
    operator_fee_percentage?: number; // Taxa da operadora/maquina (%)
    operator_fee_amount?: number; // Custo da operadora/maquina em centavos
    total_with_fee: number; // Valor total (amount + fee_amount)
    due_date?: string; // Data de vencimento se for a_prazo (YYYY-MM-DD)
    pix_payment_id?: string;
    mercado_pago_payment_id?: string;
    pix_status?: 'pending' | 'approved' | 'rejected' | 'expired' | 'error';
}

/**
 * Delivery Types
 */
export type DeliveryType = 'store_pickup' | 'store_delivery' | 'hybrid_delivery' | 'pickup' | 'delivery' | 'hybrid';

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

    // Garantia Estendida
    warranty_months?: number; // Meses de garantia estendida
    warranty_price?: number; // Valor da garantia em centavos

    // Campos extras para o Termo de Garantia (não enviados ao banco)
    product_specs?: { color?: string; ram?: string; storage?: string; imei1?: string; imei2?: string; [key: string]: string | undefined };
    product_brand?: string; // Marca do produto
    product_model?: string; // Modelo do produto
    product_category_id?: string;
    product_category_slug?: string;
    product_category_name?: string;

    // Unidade serializada vinculada (bip de IMEI no PDV)
    serialized_unit?: {
        unitId?: string;
        imei1?: string;
        imei2?: string;
        serial?: string;
    };

    // Selecoes de componentes variaveis de um combo (ex.: cor da capa)
    comboSelections?: Array<{
        group_key?: string;
        label?: string;
        quantity?: number;
        option?: {
            id?: string;
            name?: string;
            sku?: string;
        };
    }>;
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
    delivery_person_customer_id?: string | null;
    delivery_cost_store?: number; // em centavos
    delivery_cost_customer?: number; // em centavos
    delivery_total?: number; // em centavos

    // Discount fields
    promotional_discount?: number; // em centavos
    coupon_code?: string;
    coupon_id?: string;
    final_adjustment_discount?: number; // em centavos

    // Indicação (Referral)
    referral_code?: string;

    // Observação interna
    internal_notes?: string;

    // Auditoria do fechamento do PDV
    finalization_status?: 'success' | 'needs_review';
    finalization_log?: string;
    finalization_error_summary?: string;

    // Importação legada (MV-Gestao)
    legacy_sale_id?: string;
    legacy_pdf_url?: string;

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
    delivery_person_customer_id?: string | null;
    delivery_cost_store?: number; // em centavos
    delivery_cost_customer?: number; // em centavos
    delivery_total?: number; // em centavos

    // Discount fields
    promotional_discount?: number; // em centavos
    coupon_code?: string;
    coupon_id?: string;
    final_adjustment_discount?: number; // em centavos

    // Indicação (Referral)
    referral_code?: string;

    // Auditoria do fechamento do PDV
    finalization_status?: 'success' | 'needs_review';
    finalization_log?: string;
    finalization_error_summary?: string;
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
    delivery_job?: SaleDeliveryJobSummary | null;
}

export interface SaleDeliveryJobSummary {
    id: string;
    token: string;
    sale_id: string;
    payment_status?: 'not_required' | 'pending' | 'approved' | 'failed' | 'cancelled';
    delivery_status?: 'pending' | 'in_route' | 'delivered' | 'cancelled';
    delivery_route_url?: string | null;
    completed_by_admin_at?: string | null;
    admin_completion_reason?: string | null;
}

export interface SaleDeliveryJobSummary {
    id: string;
    token: string;
    sale_id: string;
    payment_status?: 'not_required' | 'pending' | 'approved' | 'failed' | 'cancelled';
    delivery_status?: 'pending' | 'in_route' | 'delivered' | 'cancelled';
    delivery_route_url?: string | null;
    completed_by_admin_at?: string | null;
    admin_completion_reason?: string | null;
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
