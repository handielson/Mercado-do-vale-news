export interface TeamMemberAddress {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
}

export type Role = 'seller' | 'delivery' | 'manager' | 'admin' | 'stock';
export type EmploymentType = 'clt' | 'freelancer' | 'pj';

export interface TeamMember {
    id: string;
    name: string;
    cpf_cnpj: string;
    birth_date?: string;

    // Tipo e Função
    role: Role;
    department?: string;
    employment_type: EmploymentType;

    // Contato
    email?: string;
    phone?: string;

    // Endereço
    address?: TeamMemberAddress;

    // Informações de Trabalho
    hire_date: string;

    // Remuneração
    salary?: number; // Para CLT
    hourly_rate?: number; // Para Freelancer/PJ
    commission_rate?: number; // % de comissão
    delivery_fee?: number; // Taxa por entrega

    // Status
    is_active: boolean;

    // Permissões
    permissions?: Record<string, any>;

    // Observações
    admin_notes?: string;

    // Metadados
    created_at: string;
    updated_at: string;
}

export interface TeamMemberInput {
    name: string;
    cpf_cnpj: string;
    birth_date?: string;

    // Tipo e Função
    role: Role;
    department?: string;
    employment_type: EmploymentType;

    // Contato
    email?: string;
    phone?: string;

    // Endereço
    address?: Partial<TeamMemberAddress>;

    // Informações de Trabalho
    hire_date: string;

    // Remuneração
    salary?: number;
    hourly_rate?: number;
    commission_rate?: number;
    delivery_fee?: number;

    // Status
    is_active?: boolean;

    // Permissões
    permissions?: Record<string, any>;

    // Observações
    admin_notes?: string;
}

export interface TeamMemberFilters {
    search?: string;
    role?: Role;
    employment_type?: EmploymentType;
    is_active?: boolean;
    created_after?: string;
    created_before?: string;
}
