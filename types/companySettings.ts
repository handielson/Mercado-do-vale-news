// Company Settings Types

export interface WarrantyOption {
    months: number;
    percentage: number;
    active: boolean;
}

export interface LocalHoliday {
    date: string;  // 'YYYY-MM-DD'
    label: string; // ex: 'Rodeio de Petrolina'
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
    payment_receipt_template?: string;
    receipt_extra_page_text?: string;
    receipt_extra_page_qr_url?: string;
    receipt_show_extra_page: boolean;
    extended_warranty_options?: WarrantyOption[];
    extended_warranty_terms_text?: string;
    pix_discount_percentage?: number;

    default_a4_header?: string;
    default_thermal_header?: string;
    debt_clearance_template?: string;
    delivery_receipt_template?: string;
    extended_warranty_template?: string;

    ai_prompts?: any;
    business_hours?: BusinessHours;
    holiday_overrides?: string[];
    local_holidays?: LocalHoliday[];
    business_hours_display_text?: string; // Texto editável exibido publicamente nos horários

    // Labels customizáveis do badge de status da loja
    store_label_open?: string;          // Default: "Loja Aberta"
    store_label_closed?: string;        // Default: "Fechado"
    store_label_closing_soon?: string;  // Default: "Fechando em breve"
    store_label_lunch?: string;         // Default: "Retorna às {hora}"

    // Vídeos Synology por SKU
    synology_video_base_url?: string;   // URL base (ex: https://mdvvideos.i234.me/videos/)
    synology_video_extension?: string;  // Extensão (ex: .mp4, .webm) — padrão: .mp4
    
    // Shopee Integration
    shopee_partner_id?: string;
    shopee_partner_key?: string;
    shopee_shop_id?: string;
    shopee_access_token?: string;
    shopee_refresh_token?: string;

    created_at: string;
    updated_at: string;
}

export interface CompanySettingsInput {
    company_name?: string;
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
    payment_receipt_template?: string;
    receipt_extra_page_text?: string;
    receipt_extra_page_qr_url?: string;
    receipt_show_extra_page?: boolean;
    extended_warranty_options?: WarrantyOption[];
    extended_warranty_terms_text?: string;
    pix_discount_percentage?: number;

    default_a4_header?: string;
    default_thermal_header?: string;
    debt_clearance_template?: string;
    delivery_receipt_template?: string;
    extended_warranty_template?: string;

    ai_prompts?: any;
    business_hours?: BusinessHours;
    holiday_overrides?: string[];
    local_holidays?: LocalHoliday[];
    business_hours_display_text?: string;

    store_label_open?: string;
    store_label_closed?: string;
    store_label_closing_soon?: string;
    store_label_lunch?: string;

    // Vídeos Synology por SKU
    synology_video_base_url?: string;
    synology_video_extension?: string;

    // Shopee Integration
    shopee_partner_id?: string;
    shopee_partner_key?: string;
    shopee_shop_id?: string;
    shopee_access_token?: string;
    shopee_refresh_token?: string;
}
