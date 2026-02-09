/**
 * Address information from CEP lookup
 */
export interface Address {
    cep: string;
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    number?: string;
    complement?: string;
}

/**
 * ViaCEP API response
 */
interface ViaCEPResponse {
    cep: string;
    logradouro: string;
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    erro?: boolean;
}

/**
 * Lookup address by CEP using ViaCEP API
 */
export async function lookupCEP(cep: string): Promise<Address> {
    // Remove non-numeric characters
    const cleanCEP = cep.replace(/\D/g, '');

    // Validate CEP format (8 digits)
    if (cleanCEP.length !== 8) {
        throw new Error('CEP inválido. Deve conter 8 dígitos.');
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);

        if (!response.ok) {
            throw new Error('Erro ao buscar CEP. Tente novamente.');
        }

        const data: ViaCEPResponse = await response.json();

        if (data.erro) {
            throw new Error('CEP não encontrado.');
        }

        return {
            cep: formatCEP(data.cep),
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Erro ao buscar CEP. Verifique sua conexão.');
    }
}

/**
 * Format CEP with mask (12345-678)
 */
export function formatCEP(cep: string): string {
    const clean = cep.replace(/\D/g, '');
    return clean.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}
