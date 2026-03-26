/**
 * Company Data Types
 * Defines the structure for company information
 */

export interface CompanyAddress {
    zipCode: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    lat?: number;
    lng?: number;
}

export interface CompanySocialMedia {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    website?: string;
}

export interface Company {
    // Identification
    name: string; // Nome Fantasia
    razaoSocial?: string; // Razão Social (nome oficial)
    cnpj: string;
    stateRegistration?: string; // IE - Inscrição Estadual
    cnae?: string; // CNAE Principal
    situacaoCadastral?: string; // Situação na Receita Federal
    dataAbertura?: string; // Data de abertura
    porte?: string; // Porte da empresa (MEI, ME, EPP, etc.)
    phone: string;
    email: string;
    logo: string | null;
    logoUrl?: string; // URL do logo (alternativa ao base64)
    watermarkLogoUrl?: string | null; // Logo sem fundo/branco pra usar como marca d'água
    favicon?: string | null;

    // Address
    address: CompanyAddress;

    // Social Media
    socialMedia: CompanySocialMedia;
    googleReviewsLink?: string;

    // Financial
    pixKey?: string;
    pixKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';
    pixBeneficiaryName?: string; // Nome do beneficiário da chave PIX
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
    pixDiscountPercentage?: number;

    // Additional Info
    businessHours?: string;
    description?: string;
    internalNotes?: string;
    catalogFooterText?: string; // Texto do rodapé exibido no catálogo público
    aboutUsText?: string; // Texto para a página Quem Somos
    aboutUsImageUrl?: string; // Imagem para a página Quem Somos

    // Integrations
    googleAnalyticsId?: string; // Google Analytics Measurement ID (ex: G-XXXXXXXXXX)
    synologyVideoBaseUrl?: string; // URL base para vídeos no Synology (ex: http://192.168.1.2/videos/)
    synologyVideoExtension?: string; // Extensão dos vídeos (ex: .mp4, .webm) — padrão: .mp4
    shopee_partner_id?: string;
    shopee_partner_key?: string;
    shopee_shop_id?: string;
    shopee_access_token?: string;
    shopee_refresh_token?: string;
    shopee_printer_thermal?: string;
    shopee_printer_a4?: string;

    // Maintenance Mode
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    maintenanceBypassKey?: string;
}

export const defaultCompany: Company = {
    name: '',
    razaoSocial: '',
    cnpj: '',
    stateRegistration: '',
    cnae: '',
    situacaoCadastral: '',
    dataAbertura: '',
    porte: '',
    phone: '',
    email: '',
    logo: null,
    favicon: null,
    address: {
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: ''
    },
    socialMedia: {
        instagram: '',
        facebook: '',
        youtube: '',
        website: ''
    },
    googleReviewsLink: '',
    pixKey: '',
    pixKeyType: undefined,
    pixBeneficiaryName: '',
    bankName: '',
    bankAgency: '',
    bankAccount: '',
    pixDiscountPercentage: 0,
    businessHours: '',
    description: '',
    internalNotes: '',
    catalogFooterText: '© 2026 Mercado do Vale. Todos os direitos reservados. As informações, preços e disponibilidade de produtos estão sujeitos a alterações sem aviso prévio.',
    aboutUsText: '',
    aboutUsImageUrl: '',
    googleAnalyticsId: '',
    synologyVideoBaseUrl: '',
    synologyVideoExtension: '.mp4',
    shopee_printer_thermal: '',
    shopee_printer_a4: '',
    maintenanceMode: false,
    maintenanceMessage: 'Voltamos logo! Estamos realizando manutenções no servidor para melhorar sua experiência.',
    maintenanceBypassKey: 'liberado'
};
