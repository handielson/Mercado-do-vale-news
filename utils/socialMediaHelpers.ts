/**
 * Social Media URL Formatters and Validators
 * Helper functions for formatting and validating social media URLs
 */

/**
 * Format Instagram URL from username or full URL
 * @param value - Username (with or without @) or full URL
 * @returns Formatted Instagram URL
 */
export const formatInstagramUrl = (value: string): string => {
    if (!value) return '';
    if (value.startsWith('http')) return value;
    const username = value.replace('@', '').trim();
    return `https://instagram.com/${username}`;
};

/**
 * Format Facebook URL from username/page or full URL
 * @param value - Username/page name or full URL
 * @returns Formatted Facebook URL
 */
export const formatFacebookUrl = (value: string): string => {
    if (!value) return '';
    if (value.startsWith('http')) return value;
    const page = value.trim();
    return `https://facebook.com/${page}`;
};

/**
 * Format YouTube URL from channel/user or full URL
 * @param value - Channel name or full URL
 * @returns Formatted YouTube URL
 */
export const formatYoutubeUrl = (value: string): string => {
    if (!value) return '';
    if (value.startsWith('http')) return value;
    const channel = value.trim();
    // Try to detect if it's a channel ID or username
    if (channel.startsWith('UC') && channel.length === 24) {
        return `https://youtube.com/channel/${channel}`;
    }
    return `https://youtube.com/@${channel}`;
};

/**
 * Validate if a string is a valid URL
 * @param url - URL string to validate
 * @returns True if valid URL
 */
export const isValidUrl = (url: string): boolean => {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

/**
 * Copy text to clipboard
 * @param text - Text to copy
 * @returns Promise<boolean> - True if successful
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Erro ao copiar para clipboard:', err);
        return false;
    }
};

/**
 * Get social media platform from URL
 * @param url - Social media URL
 * @returns Platform name or 'unknown'
 */
export const getSocialMediaPlatform = (url: string): string => {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('instagram.com')) return 'instagram';
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com')) return 'facebook';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
    if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
    if (lowerUrl.includes('linkedin.com')) return 'linkedin';

    return 'website';
};
