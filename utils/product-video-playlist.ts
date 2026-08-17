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

export type ProductVideoSource = {
    sku?: string | null;
    video_url?: string | null;
    marketing_video_url?: string | null;
    specs?: {
        ram?: string | null;
        storage?: string | null;
    } | null;
};

function normalizeVariantSpec(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
}

function normalizeVideoModelName(value: string | null | undefined): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function isSafeProductVideoSibling(
    product: ProductVideoSource & { model_id?: string | null; name?: string | null },
    sibling: ProductVideoSource & { model_id?: string | null; name?: string | null },
): boolean {
    const modelId = String(product.model_id || '').trim();
    if (!modelId || modelId === '0' || modelId !== String(sibling.model_id || '').trim()) return false;

    const productName = normalizeVideoModelName(product.name);
    const siblingName = normalizeVideoModelName(sibling.name);
    if (productName.length < 4 || siblingName.length < 4) return false;
    return productName === siblingName
        || siblingName.startsWith(`${productName} `)
        || productName.startsWith(`${siblingName} `);
}

export function orderProductVideoSiblings(
    product: ProductVideoSource,
    siblings: ProductVideoSource[] = [],
): ProductVideoSource[] {
    const productRam = normalizeVariantSpec(product.specs?.ram);
    const productStorage = normalizeVariantSpec(product.specs?.storage);
    return [...siblings].sort((left, right) => {
        const leftMatches = normalizeVariantSpec(left.specs?.ram) === productRam
            && normalizeVariantSpec(left.specs?.storage) === productStorage;
        const rightMatches = normalizeVariantSpec(right.specs?.ram) === productRam
            && normalizeVariantSpec(right.specs?.storage) === productStorage;
        return Number(rightMatches) - Number(leftMatches);
    });
}

/**
 * Resolve o vídeo do PDP sem deixar uma cor/versão sem mídia quando o vídeo foi
 * cadastrado em outro SKU do mesmo modelo. A página é responsável por entregar
 * apenas irmãos já validados pela chave segura de agrupamento.
 */
export function resolveProductVideoUrl(
    product: ProductVideoSource | null | undefined,
    siblings: ProductVideoSource[] = [],
): string | null {
    if (!product) return null;

    const ownVideo = product.video_url?.trim() || product.marketing_video_url?.trim();
    if (ownVideo) return ownVideo;

    for (const sibling of orderProductVideoSiblings(product, siblings)) {
        const siblingVideo = sibling.video_url?.trim() || sibling.marketing_video_url?.trim();
        if (siblingVideo) return siblingVideo;
    }

    return null;
}
