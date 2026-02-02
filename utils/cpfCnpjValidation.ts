/**
 * CPF/CNPJ Validation and Formatting Utilities
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Pure functions for validation
 * - Official Brazilian algorithm
 * - Type-safe
 */

/**
 * Validates a Brazilian CPF (Cadastro de Pessoas Físicas)
 * Uses official algorithm with verification digits
 */
export function validateCPF(cpf: string): boolean {
    // Remove non-numeric characters
    const cleaned = cpf.replace(/\D/g, '');

    // Check length
    if (cleaned.length !== 11) return false;

    // Reject known invalid patterns (all same digits)
    if (/^(\d)\1{10}$/.test(cleaned)) return false;

    // Calculate first verification digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let digit1 = 11 - (sum % 11);
    if (digit1 >= 10) digit1 = 0;

    // Check first digit
    if (digit1 !== parseInt(cleaned.charAt(9))) return false;

    // Calculate second verification digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    let digit2 = 11 - (sum % 11);
    if (digit2 >= 10) digit2 = 0;

    // Check second digit
    return digit2 === parseInt(cleaned.charAt(10));
}

/**
 * Validates a Brazilian CNPJ (Cadastro Nacional da Pessoa Jurídica)
 * Uses official algorithm with verification digits
 */
export function validateCNPJ(cnpj: string): boolean {
    // Remove non-numeric characters
    const cleaned = cnpj.replace(/\D/g, '');

    // Check length
    if (cleaned.length !== 14) return false;

    // Reject known invalid patterns (all same digits)
    if (/^(\d)\1{13}$/.test(cleaned)) return false;

    // Weights for first digit
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    // Calculate first verification digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleaned.charAt(i)) * weights1[i];
    }
    let digit1 = sum % 11;
    digit1 = digit1 < 2 ? 0 : 11 - digit1;

    // Check first digit
    if (digit1 !== parseInt(cleaned.charAt(12))) return false;

    // Weights for second digit
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    // Calculate second verification digit
    sum = 0;
    for (let i = 0; i < 13; i++) {
        sum += parseInt(cleaned.charAt(i)) * weights2[i];
    }
    let digit2 = sum % 11;
    digit2 = digit2 < 2 ? 0 : 11 - digit2;

    // Check second digit
    return digit2 === parseInt(cleaned.charAt(13));
}

/**
 * Validates CPF or CNPJ automatically detecting the type
 */
export function validateCpfCnpj(value: string): boolean {
    if (!value) return true; // Empty is valid (optional field)

    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length === 11) {
        return validateCPF(cleaned);
    } else if (cleaned.length === 14) {
        return validateCNPJ(cleaned);
    }

    return false;
}

/**
 * Formats CPF or CNPJ with proper masks
 * CPF: 123.456.789-01
 * CNPJ: 12.345.678/0001-90
 */
export function formatCpfCnpj(value: string): string {
    if (!value) return '';

    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length <= 11) {
        // Format as CPF
        return cleaned
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        // Format as CNPJ
        return cleaned
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
}

/**
 * Formats phone number
 * (11) 98765-4321
 */
export function formatPhone(value: string): string {
    if (!value) return '';

    const cleaned = value.replace(/\D/g, '');

    if (cleaned.length <= 10) {
        // Landline: (11) 3456-7890
        return cleaned
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    } else {
        // Mobile: (11) 98765-4321
        return cleaned
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
    if (!email) return true; // Empty is valid (optional field)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
