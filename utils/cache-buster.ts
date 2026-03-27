/**
 * Utility to append a cache-busting timestamp to media URLs.
 * This prevents the browser from aggressively caching images and videos
 * when they are replaced on the server but keep the same filename/URL.
 */
export const getCacheBustedUrl = (url?: string | null, timestamp?: string | Date | number | null): string => {
    if (!url) return '';
    // Don't append to base64 data URIs
    if (url.startsWith('data:')) return url;
    if (!timestamp) return url;
    
    try {
        const timeMs = new Date(timestamp).getTime();
        if (isNaN(timeMs)) return url;
        
        // If the URL already has some parameters, use '&', otherwise '?'
        if (url.includes(`v=${timeMs}`)) return url; // Already busted with this timestamp
        
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}v=${timeMs}`;
    } catch {
        return url;
    }
};
