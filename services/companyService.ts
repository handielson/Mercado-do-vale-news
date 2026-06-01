/**
 * Company Data Service - VPS Integration
 * Manages company information storage and retrieval using the VPS API.
 */

import { Company, defaultCompany } from '../types/company';
import { vpsClient } from './vpsClient';

/**
 * Database row type for company_settings table
 */
interface CompanySettingsRow {
    id: string;
    name: string;
    razao_social: string | null;
    cnpj: string | null;
    state_registration: string | null;
    cnae: string | null;
    situacao_cadastral: string | null;
    data_abertura: string | null;
    porte: string | null;
    phone: string | null;
    email: string | null;
    logo: string | null;
    watermark_url: string | null;
    favicon: string | null;
    address_zip_code: string | null;
    address_street: string | null;
    address_number: string | null;
    address_complement: string | null;
    address_neighborhood: string | null;
    address_city: string | null;
    address_state: string | null;
    address_lat: number | null;
    address_lng: number | null;
    social_instagram: string | null;
    social_facebook: string | null;
    social_youtube: string | null;
    social_website: string | null;
    google_reviews_link: string | null;
    pix_key: string | null;
    pix_key_type: string | null;
    pix_beneficiary_name: string | null;
    pix_discount_percentage: number | null;
    bank_name: string | null;
    bank_agency: string | null;
    bank_account: string | null;
    business_hours: string | null;
    description: string | null;
    internal_notes: string | null;
    google_analytics_id: string | null;
    synology_video_base_url: string | null;
    synology_video_extension: string | null;
    shopee_partner_id: string | null;
    shopee_partner_key: string | null;
    shopee_shop_id: string | null;
    shopee_access_token: string | null;
    shopee_refresh_token: string | null;
    shopee_printer_thermal: string | null;
    shopee_printer_a4: string | null;
    catalog_footer_text: string | null;
    maintenance_mode: boolean | null;
    maintenance_message: string | null;
    maintenance_bypass_key: string | null;
    about_us_text: string | null;
    about_us_image_url: string | null;
    created_at: string;
    updated_at: string;
}

const rowToCompany = (row: CompanySettingsRow): Company => ({
    name: row.name,
    razaoSocial: row.razao_social || '',
    cnpj: row.cnpj || '',
    stateRegistration: row.state_registration || '',
    cnae: row.cnae || '',
    situacaoCadastral: row.situacao_cadastral || '',
    dataAbertura: row.data_abertura || '',
    porte: row.porte || '',
    phone: row.phone || '',
    email: row.email || '',
    logo: row.logo,
    logoUrl: row.logo || '',
    watermarkLogoUrl: row.watermark_url || '',
    favicon: row.favicon,
    address: {
        zipCode: row.address_zip_code || '',
        street: row.address_street || '',
        number: row.address_number || '',
        complement: row.address_complement || '',
        neighborhood: row.address_neighborhood || '',
        city: row.address_city || '',
        state: row.address_state || '',
        lat: row.address_lat || undefined,
        lng: row.address_lng || undefined,
    },
    socialMedia: {
        instagram: row.social_instagram || '',
        facebook: row.social_facebook || '',
        youtube: row.social_youtube || '',
        website: row.social_website || '',
    },
    googleReviewsLink: row.google_reviews_link || '',
    pixKey: row.pix_key || '',
    pixKeyType: (row.pix_key_type as any) || undefined,
    pixBeneficiaryName: row.pix_beneficiary_name || '',
    pixDiscountPercentage: Number(row.pix_discount_percentage) || 0,
    bankName: row.bank_name || '',
    bankAgency: row.bank_agency || '',
    bankAccount: row.bank_account || '',
    businessHours: row.business_hours || '',
    description: row.description || '',
    internalNotes: row.internal_notes || '',
    googleAnalyticsId: row.google_analytics_id || '',
    synologyVideoBaseUrl: row.synology_video_base_url || '',
    synologyVideoExtension: row.synology_video_extension || '.mp4',
    shopee_partner_id: row.shopee_partner_id || '',
    shopee_partner_key: row.shopee_partner_key || '',
    shopee_shop_id: row.shopee_shop_id || '',
    shopee_access_token: row.shopee_access_token || '',
    shopee_refresh_token: row.shopee_refresh_token || '',
    shopee_printer_thermal: row.shopee_printer_thermal || '',
    shopee_printer_a4: row.shopee_printer_a4 || '',
    catalogFooterText: row.catalog_footer_text || '',
    maintenanceMode: row.maintenance_mode ?? false,
    maintenanceMessage: row.maintenance_message || '',
    maintenanceBypassKey: row.maintenance_bypass_key || '',
    aboutUsText: row.about_us_text || '',
    aboutUsImageUrl: row.about_us_image_url || '',
});

const companyToRow = (company: Company): Partial<CompanySettingsRow> => ({
    name: company.name,
    razao_social: company.razaoSocial || null,
    cnpj: company.cnpj || null,
    state_registration: company.stateRegistration || null,
    cnae: company.cnae || null,
    situacao_cadastral: company.situacaoCadastral || null,
    data_abertura: company.dataAbertura ? company.dataAbertura.split('T')[0] : null,
    porte: company.porte || null,
    phone: company.phone || null,
    email: company.email || null,
    logo: company.logo,
    watermark_url: company.watermarkLogoUrl || null,
    favicon: company.favicon || null,
    address_zip_code: company.address.zipCode || null,
    address_street: company.address.street || null,
    address_number: company.address.number || null,
    address_complement: company.address.complement || null,
    address_neighborhood: company.address.neighborhood || null,
    address_city: company.address.city || null,
    address_state: company.address.state || null,
    address_lat: company.address.lat || null,
    address_lng: company.address.lng || null,
    social_instagram: company.socialMedia?.instagram || null,
    social_facebook: company.socialMedia?.facebook || null,
    social_youtube: company.socialMedia?.youtube || null,
    social_website: company.socialMedia?.website || null,
    google_reviews_link: company.googleReviewsLink || null,
    pix_key: company.pixKey || null,
    pix_key_type: company.pixKeyType || null,
    pix_beneficiary_name: company.pixBeneficiaryName || null,
    pix_discount_percentage: company.pixDiscountPercentage || 0,
    bank_name: company.bankName || null,
    bank_agency: company.bankAgency || null,
    bank_account: company.bankAccount || null,
    business_hours: company.businessHours || null,
    description: company.description || null,
    internal_notes: company.internalNotes || null,
    google_analytics_id: company.googleAnalyticsId || null,
    synology_video_base_url: company.synologyVideoBaseUrl || null,
    synology_video_extension: company.synologyVideoExtension || null,
    ...(company.shopee_partner_id ? { shopee_partner_id: company.shopee_partner_id } : {}),
    ...(company.shopee_partner_key ? { shopee_partner_key: company.shopee_partner_key } : {}),
    ...(company.shopee_shop_id ? { shopee_shop_id: company.shopee_shop_id } : {}),
    ...(company.shopee_access_token ? { shopee_access_token: company.shopee_access_token } : {}),
    ...(company.shopee_refresh_token ? { shopee_refresh_token: company.shopee_refresh_token } : {}),
    shopee_printer_thermal: company.shopee_printer_thermal || null,
    shopee_printer_a4: company.shopee_printer_a4 || null,
    catalog_footer_text: company.catalogFooterText || null,
    maintenance_mode: company.maintenanceMode ?? null,
    maintenance_message: company.maintenanceMessage || null,
    maintenance_bypass_key: company.maintenanceBypassKey || null,
    about_us_text: company.aboutUsText || null,
    about_us_image_url: company.aboutUsImageUrl || null,
});

export const getCompanyData = async (): Promise<Company> => {
    try {
        const data = await vpsClient.get<any>('/company-settings');
        if (!data) return defaultCompany;
        return rowToCompany(data as CompanySettingsRow);
    } catch (error: any) {
        if (error?.name === 'AbortError' || error?.message === 'AbortError' || error?.message?.includes('aborted')) {
            console.log('[companyService] VPS fetch aborted - returning defaults');
            return defaultCompany;
        }
        console.error('[companyService] VPS fetch error:', error);
        return defaultCompany;
    }
};

export const saveCompanyData = async (data: Company): Promise<void> => {
    try {
        const row = companyToRow(data);
        await vpsClient.patch('/company-settings', row);
    } catch (error) {
        console.error('[companyService] VPS update error:', error);
        throw new Error('Erro ao salvar dados da empresa');
    }
};

export const clearCompanyData = async (): Promise<void> => {
    try {
        await vpsClient.patch('/company-settings', companyToRow(defaultCompany));
    } catch (error) {
        console.error('[companyService] VPS clear error:', error);
        throw new Error('Erro ao limpar dados da empresa');
    }
};
