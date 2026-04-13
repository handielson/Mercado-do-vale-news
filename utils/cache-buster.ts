/**
 * Utility to append a cache-busting timestamp to media URLs.
 * This prevents the browser from aggressively caching images and videos
 * when they are replaced on the server but keep the same filename/URL.
 */
import { toBrowserSafeMediaUrl } from './media-url';

export const getCacheBustedUrl = (url?: string | null, timestamp?: string | Date | number | null): string => {
    if (!url) return '';
    const safeUrl = toBrowserSafeMediaUrl(url);
    // Don't append to base64 data URIs
    if (safeUrl.startsWith('data:')) return safeUrl;
    if (!timestamp) return safeUrl;
    
    try {
        const timeMs = new Date(timestamp).getTime();
        if (isNaN(timeMs)) return safeUrl;
        
        // If the URL already has some parameters, use '&', otherwise '?'
        if (safeUrl.includes(`v=${timeMs}`)) return safeUrl; // Already busted with this timestamp
        
        const separator = safeUrl.includes('?') ? '&' : '?';
        return `${safeUrl}${separator}v=${timeMs}`;
    } catch {
        return safeUrl;
    }
};
