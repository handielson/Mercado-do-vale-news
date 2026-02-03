import { CustomerAddress } from '../types/customer';

/**
 * Capitalize first letter of each word in a name
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
    const nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());

    // If birthday already passed this year, calculate for next year
    if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
    }

    const diffTime = nextBirthday.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

/**
 * Get full address as a single string
 */
export const getFullAddress = (address?: Partial<CustomerAddress>): string => {
    if (!address) return '';

    const parts = [
        address.street,
        address.number,
        address.neighborhood,
        address.city,
        address.state,
        'Brasil'
    ].filter(Boolean);

    return parts.join(', ');
};

/**
 * Get Google Maps URL for an address
 */
export const getGoogleMapsUrl = (address?: Partial<CustomerAddress>): string | null => {
    const fullAddress = getFullAddress(address);
    if (!fullAddress) return null;

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
};

/**
 * Get WhatsApp URL with welcome message
 */
export const getWhatsAppUrl = (phone: string, name: string): string | null => {
    if (!phone) return null;

    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) return null;

    // TODO: In the future, fetch welcome message from settings/database
    // For now, use a default message
    const welcomeMessage = `Olá ${name || 'cliente'}! Seja bem-vindo(a)!`;

    // WhatsApp link format: https://wa.me/5511999999999?text=message
    // Add country code 55 for Brazil if not present
    const phoneWithCountry = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;

    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(welcomeMessage)}`;
};

/**
 * Get Instagram profile URL
 */
export const getInstagramUrl = (username: string): string | null => {
    if (!username) return null;

    // Remove @ if present and any spaces
    const cleanUsername = username.replace(/[@\s]/g, '');
    if (!cleanUsername) return null;

    return `https://instagram.com/${cleanUsername}`;
};

/**
 * Get Facebook profile URL
 */
export const getFacebookUrl = (username: string): string | null => {
    if (!username) return null;

    // Remove spaces
    const cleanUsername = username.trim();
    if (!cleanUsername) return null;

    // If it's already a full URL, return it
    if (cleanUsername.startsWith('http')) return cleanUsername;

    // Otherwise, create URL from username
    return `https://facebook.com/${cleanUsername}`;
};
