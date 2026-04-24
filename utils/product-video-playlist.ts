export const INSTITUTIONAL_VIDEO_URL = 'https://videos.mercadodovale.com.br/mdv-institucional-3d.mp4';

export function isMp4VideoUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].split('#')[0].trim().toLowerCase();
    return cleanUrl.endsWith('.mp4');
}

export function buildProductVideoPlaylist(productVideoUrl: string | null | undefined): string[] {
    const firstUrl = productVideoUrl?.trim();
    if (!firstUrl) return [];

    if (!isMp4VideoUrl(firstUrl)) return [firstUrl];

    if (firstUrl.split('?')[0].split('#')[0] === INSTITUTIONAL_VIDEO_URL) {
        return [firstUrl];
    }

    return [firstUrl, INSTITUTIONAL_VIDEO_URL];
}
