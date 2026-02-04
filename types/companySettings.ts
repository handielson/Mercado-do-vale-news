// Company Settings Types

export interface CompanySettings {
    id: string;
    company_name: string;
    address?: string;
    phone?: string;
    cnpj?: string;
    email?: string;
    header_text?: string;
    footer_text?: string;
    warranty_terms?: string;
    receipt_logo_url?: string;
    receipt_width: '58mm' | '80mm';
    show_company_info: boolean;
    show_order_number: boolean;
    show_timestamp: boolean;
    show_seller_info: boolean;
    warranty_template?: string;
    warranty_show_logo: boolean;
    warranty_show_company_name: boolean;
    warranty_show_cnpj: boolean;
    warranty_show_phone: boolean;
    warranty_show_email: boolean;
    warranty_show_address: boolean;
    created_at: string;
    updated_at: string;
}

export interface CompanySettingsInput {
    company_name: string;
    address?: string;
    phone?: string;
    cnpj?: string;
    email?: string;
    header_text?: string;
    footer_text?: string;
    warranty_terms?: string;
    receipt_logo_url?: string;
    receipt_width?: '58mm' | '80mm';
    show_company_info?: boolean;
    show_order_number?: boolean;
    show_timestamp?: boolean;
    show_seller_info?: boolean;
    warranty_template?: string;
    warranty_show_logo?: boolean;
    warranty_show_company_name?: boolean;
    warranty_show_cnpj?: boolean;
    warranty_show_phone?: boolean;
    warranty_show_email?: boolean;
    warranty_show_address?: boolean;
}
