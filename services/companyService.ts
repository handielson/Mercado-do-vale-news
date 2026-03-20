/**
 * Company Data Service - Supabase Integration
 * Manages company information storage and retrieval using Supabase
 */

import { supabase } from './supabase';
import { Company, defaultCompany } from '../types/company';

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
    catalog_footer_text: string | null;
    maintenance_mode: boolean | null;
    maintenance_message: string | null;
    maintenance_bypass_key: string | null;
    about_us_text: string | null;
    about_us_image_url: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Convert database row to Company type
 */
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
    logoUrl: row.logo || '', // Use logo field for logoUrl
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
        lng: row.address_lng || undefined
    },
    socialMedia: {
        instagram: row.social_instagram || '',
        facebook: row.social_facebook || '',
        youtube: row.social_youtube || '',
        website: row.social_website || ''
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
    catalogFooterText: row.catalog_footer_text || '',
    maintenanceMode: row.maintenance_mode ?? false,
    maintenanceMessage: row.maintenance_message || '',
    maintenanceBypassKey: row.maintenance_bypass_key || '',
    aboutUsText: row.about_us_text || '',
    aboutUsImageUrl: row.about_us_image_url || '',
});

/**
 * Convert Company type to database row
 */
const companyToRow = (company: Company): Partial<CompanySettingsRow> => ({
    name: company.name,
    razao_social: company.razaoSocial || null,
    cnpj: company.cnpj || null,
    state_registration: company.stateRegistration || null,
    cnae: company.cnae || null,
    situacao_cadastral: company.situacaoCadastral || null,
    data_abertura: company.dataAbertura || null,
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
    catalog_footer_text: company.catalogFooterText || null,
    maintenance_mode: company.maintenanceMode ?? null,
    maintenance_message: company.maintenanceMessage || null,
    maintenance_bypass_key: company.maintenanceBypassKey || null,
    about_us_text: company.aboutUsText || null,
    about_us_image_url: company.aboutUsImageUrl || null,
});

/**
 * Get company data from Supabase
 */
export const getCompanyData = async (): Promise<Company> => {
    try {
        // Fetch company settings (single global record)
        const { data, error } = await supabase
            .from('company_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            // Requisição abortada (AbortError / CORS / timeout) – retornar padrão sem bloquear
            if (error.code === '20' || error.message?.includes('aborted') || error.message?.includes('abort')) {
                console.log('[companyService] Fetch aborted – returning defaults');
                return defaultCompany;
            }
            // If no record exists, return default
            if (error.code === 'PGRST116') {
                console.log('No company settings found, returning default');
                return defaultCompany;
            }
            console.error('Error fetching company data:', error);
            return defaultCompany;
        }

        console.log('Company data loaded successfully');
        return rowToCompany(data as CompanySettingsRow);
    } catch (error: any) {
        // Qualquer erro (AbortError, CORS, timeout) retorna padrão sem explodir
        if (error?.name === 'AbortError' || error?.message === 'AbortError' || error?.message?.includes('aborted')) {
            console.log('[companyService] Fetch aborted – returning defaults');
            return defaultCompany;
        }
        console.error('Error loading company data:', error);
        return defaultCompany;
    }
};

/**
 * Save company data to Supabase
 */
export const saveCompanyData = async (data: Company): Promise<void> => {
    try {
        const row = companyToRow(data);

        // Check if record exists (should be only one global record)
        const { data: existing } = await supabase
            .from('company_settings')
            .select('id')
            .limit(1)
            .single();

        if (existing) {
            // Update existing record
            console.log('Updating existing company settings record');
            const { error } = await supabase
                .from('company_settings')
                .update(row)
                .eq('id', existing.id);

            if (error) {
                console.error('Update error:', error);
                throw error;
            }
            console.log('Update successful');
        } else {
            // Insert new record
            const { error } = await supabase
                .from('company_settings')
                .insert([row]);

            if (error) {
                console.error('Insert error:', error);
                throw error;
            }
            console.log('Insert successful');
        }
    } catch (error) {
        console.error('Error saving company data:', error);
        throw new Error('Erro ao salvar dados da empresa');
    }
};

/**
 * Clear company data from Supabase
 */
export const clearCompanyData = async (): Promise<void> => {
    try {
        // Delete all records (should be only one)
        const { error } = await supabase
            .from('company_settings')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all real records

        if (error) throw error;
    } catch (error) {
        console.error('Error clearing company data:', error);
        throw new Error('Erro ao limpar dados da empresa');
    }
};
