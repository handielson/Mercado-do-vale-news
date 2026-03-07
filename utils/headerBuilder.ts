import { CompanySettings } from '../types/companySettings';
import { companySettingsService } from '../services/companySettingsService';

/**
 * Builds a global header by replacing template tags (like {{logo}}, {{nome_loja}})
 * and respecting global display flags (warranty_show_logo, warranty_show_cnpj...).
 */
export function buildGlobalHeader(
    template: string,
    settings: CompanySettings,
    documentName: string,
    providedLogoUrl?: string
): string {
    const companyName = settings.company_name || 'Mercado do Vale';
    const finalLogoUrl = providedLogoUrl || (settings as any).logo || settings.receipt_logo_url;

    // Apply display toggles (fallback to true to ensure backward compatibility)
    const showLogo = settings.warranty_show_logo !== false;
    const showCompanyName = settings.warranty_show_company_name !== false;
    const showCnpj = settings.warranty_show_cnpj !== false;
    const showAddress = settings.warranty_show_address !== false;
    const showPhone = settings.warranty_show_phone !== false;
    const showEmail = settings.warranty_show_email !== false;

    // Build Logo Placeholder
    const logoPlaceholder = showLogo && finalLogoUrl
        ? `<img src="${finalLogoUrl}" alt="Logo" style="max-height:80px;max-width:150px;object-fit:contain;" />`
        : showLogo
            ? `<div style="font-size:24px;font-weight:bold;color:#111827;">${showCompanyName ? companyName : 'Logo'}</div>`
            : '';

    // Values to replace
    const nomeLojaVal = showCompanyName ? companyName : '';
    const cnpjVal = showCnpj ? (settings.cnpj || '') : '';
    const enderecoVal = showAddress ? (settings.address || '') : '';
    const telefoneVal = showPhone ? (settings.phone || '') : '';
    const emailVal = showEmail ? (settings.email || '') : '';

    return template
        .replace(/{{logo}}/g, logoPlaceholder)
        .replace(/{{nome_documento}}/g, documentName)
        .replace(/{{nome_loja}}/g, nomeLojaVal)
        .replace(/{{cnpj}}/g, cnpjVal)
        .replace(/{{endereco}}/g, enderecoVal)
        .replace(/{{telefone}}/g, telefoneVal)
        .replace(/{{email}}/g, emailVal);
}

/**
 * Gets the default header template of a specific type
 */
export function getHeaderTemplate(
    type: 'default_a4_header' | 'default_thermal_header',
    settings: CompanySettings
): string {
    return settings[type] || companySettingsService.getDefaults()[type] || '';
}
