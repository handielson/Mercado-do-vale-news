/**
 * Warranty Tag Replacement Utility
 * Replaces template tags with actual data
 */

import { WarrantyTagData } from '../types/warrantyDocument';

/**
 * Replace all tags in template with actual data
 * Tags format: {{tag_name}}
 */
export function replaceWarrantyTags(
    template: string,
    data: WarrantyTagData
): string {
    let result = template;

    // Replace each tag
    Object.entries(data).forEach(([key, value]) => {
        const tag = `{{${key}}}`;
        const replacement = value || '';
        result = result.replace(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    });

    return result;
}

/**
 * Get declaration text based on delivery type
 */
export function getWarrantyDeclaration(deliveryType: 'store_pickup' | 'delivery'): string {
    if (deliveryType === 'store_pickup') {
        return 'Declaro que retirei a mercadoria na loja em perfeito estado e testei.';
    } else {
        return 'Declaro que recebi a mercadoria em perfeito estado e testei.';
    }
}

/**
 * Format date for warranty term (DD/MM/YYYY)
 */
export function formatWarrantyDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Format phone number for warranty term
 */
export function formatWarrantyPhone(phone: string): string {
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');

    // Format based on length
    if (digits.length === 11) {
        // (XX) XXXXX-XXXX
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
        // (XX) XXXX-XXXX
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return phone;
}

/**
 * Format CPF/CNPJ for warranty term
 */
export function formatWarrantyCpfCnpj(cpfCnpj: string): string {
    // Remove non-digits
    const digits = cpfCnpj.replace(/\D/g, '');

    // Format based on length
    if (digits.length === 11) {
        // CPF: XXX.XXX.XXX-XX
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    } else if (digits.length === 14) {
        // CNPJ: XX.XXX.XXX/XXXX-XX
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    }

    return cpfCnpj;
}
