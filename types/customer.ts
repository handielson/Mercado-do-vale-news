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
    company_id: string;
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
    address?: CustomerAddress;
    custom_data?: Record<string, any>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CustomerInput {
    name: string;
    cpf_cnpj?: string;
    email?: string;
    phone?: string;
    address?: Partial<CustomerAddress>;
    custom_data?: Record<string, any>;
    is_active?: boolean;
}

export interface CustomerFilters {
    search?: string;
    is_active?: boolean;
    created_after?: string;
    created_before?: string;
}
