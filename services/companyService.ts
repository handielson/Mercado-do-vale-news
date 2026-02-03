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
    user_id: string;
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
    bank_name: string | null;
    bank_agency: string | null;
    bank_account: string | null;
    business_hours: string | null;
    description: string | null;
    internal_notes: string | null;
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
    bankName: row.bank_name || '',
    bankAgency: row.bank_agency || '',
    bankAccount: row.bank_account || '',
    businessHours: row.business_hours || '',
    description: row.description || '',
    internalNotes: row.internal_notes || ''
});

/**
 * Convert Company type to database row
 */
const companyToRow = (company: Company, userId: string): Partial<CompanySettingsRow> => ({
    user_id: userId,
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
    bank_name: company.bankName || null,
    bank_agency: company.bankAgency || null,
    bank_account: company.bankAccount || null,
    business_hours: company.businessHours || null,
    description: company.description || null,
    internal_notes: company.internalNotes || null
});

/**
 * Get company data from Supabase
 */
export const getCompanyData = async (): Promise<Company> => {
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        // Use mock user ID in development mode if no real user
        const userId = user?.id || '00000000-0000-0000-0000-000000000000';

        if (!user) {
            console.warn('No authenticated user, using mock user ID for development');
        }

        // Fetch company settings
        const { data, error } = await supabase
            .from('company_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            // If no record exists, return default
            if (error.code === 'PGRST116') {
                console.log('No company settings found, returning default');
                return defaultCompany;
            }
            console.error('Error fetching company data:', error);
            throw error;
        }

        console.log('Company data loaded successfully');
        return rowToCompany(data as CompanySettingsRow);
    } catch (error) {
        console.error('Error loading company data:', error);
        return defaultCompany;
    }
};

/**
 * Save company data to Supabase
 */
export const saveCompanyData = async (data: Company): Promise<void> => {
    try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        console.log('Save attempt - User:', user?.id, 'Error:', userError);

        // Use mock user ID in development mode if no real user
        const userId = user?.id || '00000000-0000-0000-0000-000000000000';

        if (!user) {
            console.warn('No authenticated user, using mock user ID for development');
        }

        const row = companyToRow(data, userId);

        // Check if record exists
        const { data: existing } = await supabase
            .from('company_settings')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (existing) {
            // Update existing record
            console.log('Updating existing record for user:', userId);
            const { error } = await supabase
                .from('company_settings')
                .update(row)
                .eq('user_id', userId);

            if (error) {
                console.error('Update error:', error);
                throw error;
            }
            console.log('Update successful');
        } else {
            // Insert new record
            console.log('Inserting new record for user:', userId);
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
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error('Usuário não autenticado');
        }

        const { error } = await supabase
            .from('company_settings')
            .delete()
            .eq('user_id', user.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error clearing company data:', error);
        throw new Error('Erro ao limpar dados da empresa');
    }
};
