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

    // Additional Info
    businessHours?: string;
    description?: string;
    internalNotes?: string;
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
    businessHours: '',
    description: '',
    internalNotes: ''
};
