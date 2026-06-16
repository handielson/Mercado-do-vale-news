export interface CustomerAddress {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
}

export interface Customer {
    id: string;
    user_id?: string | null;  // Link to auth.users - null if account not activated
    company_id: string;
    name: string;
    cpf_cnpj?: string;
    customer_type?: 'wholesale' | 'resale' | 'retail' | 'ADMIN';
    email?: string;
    phone?: string;
    birth_date?: string;
    instagram?: string;
    facebook?: string;
    address?: CustomerAddress;
    admin_notes?: string;
    custom_data?: Record<string, any>;
    referral_code?: string; // Código único de indicação (Moedas do Vale)
    avatar_url?: string;    // Avatar do cliente (Foto de Perfil)
    is_active: boolean;
    is_delivery_worker?: boolean;
    is_walk_in_customer?: boolean;
    account_status?: 'pending' | 'active';  // Account activation status
    admin_preview_type?: 'retail' | 'resale' | 'wholesale';  // Admin catalog preview preference
    created_at: string;
    updated_at: string;
}

export interface CustomerInput {
    name: string;
    cpf_cnpj?: string;
    customer_type?: 'wholesale' | 'resale' | 'retail' | 'ADMIN';
    email?: string;
    phone?: string;
    birth_date?: string;
    instagram?: string;
    facebook?: string;
    address?: Partial<CustomerAddress>;
    admin_notes?: string;
    custom_data?: Record<string, any>;
    avatar_url?: string;
    is_active?: boolean;
    is_delivery_worker?: boolean;
    is_walk_in_customer?: boolean;
}

export interface CustomerFilters {
    search?: string;
    is_active?: boolean;
    is_delivery_worker?: boolean;
    is_walk_in_customer?: boolean;
    created_after?: string;
    created_before?: string;
}
