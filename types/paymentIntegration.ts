export type PaymentGatewayName = 'mercado_pago' | 'pagseguro' | 'stripe' | 'pagaleve';
export type PaymentEnvironment = 'production' | 'sandbox';

export interface PaymentIntegration {
    id: string;
    company_id: string;
    gateway_name: PaymentGatewayName;
    is_active: boolean;
    public_key?: string | null;
    access_token?: string | null;
    client_id?: string | null;
    client_secret?: string | null;
    environment: PaymentEnvironment;
    created_at: string;
    updated_at: string;
}

export interface PaymentIntegrationInput {
    gateway_name: PaymentGatewayName;
    is_active: boolean;
    public_key?: string | null;
    access_token?: string | null;
    client_id?: string | null;
    client_secret?: string | null;
    environment: PaymentEnvironment;
}
