/**
 * CNPJ Helper - Receita Federal Integration
 * Searches company data from Brazilian Federal Revenue Service
 */

export interface ReceitaFederalData {
    cnpj: string;
    razao_social: string;
    nome_fantasia: string;
    situacao_cadastral: string;
    data_situacao_cadastral: string;
    data_abertura: string;
    porte: string;
    uf: string;
    municipio: string;
    bairro: string;
    logradouro: string;
    numero: string;
    complemento: string;
    cep: string;
    email: string;
    telefone: string;
    atividade_principal: Array<{
        code: string;
        text: string;
    }>;
}

/**
 * Search company data by CNPJ from Receita Federal
 * Uses BrasilAPI (free, no authentication required)
 */
export const searchCNPJ = async (cnpj: string): Promise<ReceitaFederalData | null> => {
    try {
        // Remove formatting from CNPJ
        const cleanCNPJ = cnpj.replace(/\D/g, '');

        if (cleanCNPJ.length !== 14) {
            throw new Error('CNPJ deve ter 14 dígitos');
        }

        // Using BrasilAPI (free and reliable)
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('CNPJ não encontrado na Receita Federal');
            }
            throw new Error('Erro ao consultar CNPJ. Tente novamente.');
        }

        const data = await response.json();

        return {
            cnpj: data.cnpj,
            razao_social: data.razao_social || '',
            nome_fantasia: data.nome_fantasia || data.razao_social || '',
            situacao_cadastral: data.descricao_situacao_cadastral || '',
            data_situacao_cadastral: data.data_situacao_cadastral || '',
            data_abertura: data.data_inicio_atividade || '',
            porte: data.porte || '',
            uf: data.uf || '',
            municipio: data.municipio || '',
            bairro: data.bairro || '',
            logradouro: data.logradouro || '',
            numero: data.numero || '',
            complemento: data.complemento || '',
            cep: data.cep || '',
            email: data.email || '',
            telefone: data.ddd_telefone_1 || '',
            atividade_principal: data.cnae_fiscal ? [{
                code: data.cnae_fiscal,
                text: data.cnae_fiscal_descricao || ''
            }] : []
        };
    } catch (error) {
        console.error('Error searching CNPJ:', error);
        throw error;
    }
};

/**
 * Format CNPJ with mask: 00.000.000/0000-00
 */
export const formatCNPJMask = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

/**
 * Validate CNPJ using algorithm
 */
export const isValidCNPJ = (cnpj: string): boolean => {
    const cleaned = cnpj.replace(/\D/g, '');

    if (cleaned.length !== 14) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false; // All same digits

    let length = cleaned.length - 2;
    let numbers = cleaned.substring(0, length);
    const digits = cleaned.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length = length + 1;
    numbers = cleaned.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
        sum += parseInt(numbers.charAt(length - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(digits.charAt(1));
};
