// Company Settings Types

export interface WarrantyOption {
    months: number;
    percentage: number;
    active: boolean;
}

export interface DaySchedule {
    isOpen: boolean;
    openTime: string; // "HH:MM" format
    closeTime: string; // "HH:MM" format
    hasLunchBreak?: boolean;
    lunchStart?: string; // "HH:MM" format
    lunchEnd?: string; // "HH:MM" format
}

export interface BusinessHours {
    monday: DaySchedule;
    tuesday: DaySchedule;
    wednesday: DaySchedule;
    thursday: DaySchedule;
    friday: DaySchedule;
    saturday: DaySchedule;
    sunday: DaySchedule;
}

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
    receipt_width: '58mm' | '80mm' | '100mm';
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
    receipt_extra_page_text?: string;
    receipt_extra_page_qr_url?: string;
    receipt_show_extra_page: boolean;
    extended_warranty_options?: WarrantyOption[];
    extended_warranty_terms_text?: string;
    ai_prompts?: any;
    business_hours?: BusinessHours;
    holiday_overrides?: string[];
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
    receipt_width?: '58mm' | '80mm' | '100mm';
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
    receipt_extra_page_text?: string;
    receipt_extra_page_qr_url?: string;
    receipt_show_extra_page?: boolean;
    extended_warranty_options?: WarrantyOption[];
    extended_warranty_terms_text?: string;
    ai_prompts?: any;
    business_hours?: BusinessHours;
    holiday_overrides?: string[];
}
