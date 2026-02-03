/**
 * Customer Form Utilities
 * 
 * ANTIGRAVITY PROTOCOL:
 * - Pure functions for form logic
 * - Reusable across customer forms
 */

/**
 * Capitalize name (first letter of each word)
 */
export const capitalizeName = (name: string): string => {
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Calculate age from birth date
 */
export const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }

    return age;
};

/**
 * Calculate days until next birthday
 */
export const daysUntilBirthday = (birthDate: string): number | null => {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);
    const nextBirthday = new Date(
        today.getFullYear(),
        birth.getMonth(),
        birth.getDate()
    );

    // If birthday already passed this year, use next year
    if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
    }

    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

/**
 * Format CEP
 */
export const formatCep = (cep: string): string => {
    const cleaned = cep.replace(/\\D/g, '');
    if (cleaned.length !== 8) return cep;
    return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
};

/**
 * Search CEP using ViaCEP API
 */
export interface CepResult {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
}

export const searchCep = async (cep: string): Promise<CepResult | null> => {
    const cleaned = cep.replace(/\\D/g, '');
    if (cleaned.length !== 8) return null;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const data = await response.json();

        if (data.erro) return null;

        return {
            street: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || '',
            zipCode: cleaned
        };
    } catch (err) {
        console.error('Error searching CEP:', err);
        return null;
    }
};

/**
 * Build full address string
 */
export const getFullAddress = (address: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
}): string | null => {
    if (!address?.street || !address?.number || !address?.city || !address?.state) {
        return null;
    }

    const parts = [
        address.street,
        address.number,
        address.complement,
        address.neighborhood,
        address.city,
        address.state,
        'Brasil'
    ].filter(Boolean);

    return parts.join(', ');
};

/**
 * Get Google Maps URL for address
 */
export const getGoogleMapsUrl = (address: any): string | null => {
    const fullAddress = getFullAddress(address);
    if (!fullAddress) return null;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
};

/**
 * Get WhatsApp URL with welcome message
 */
export const getWhatsAppUrl = (phone: string, name?: string): string | null => {
    if (!phone) return null;

    const cleaned = phone.replace(/\\D/g, '');
    if (cleaned.length < 10) return null;

    const welcomeMessage = `Olá ${name || 'cliente'}! Seja bem-vindo(a)!`;
    const phoneWithCountry = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;

    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(welcomeMessage)}`;
};
