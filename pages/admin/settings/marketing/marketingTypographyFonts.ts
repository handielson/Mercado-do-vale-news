import type { MarketingTypographyFontOption } from '../../../../utils/marketing-typography';

const loadedFontIds = new Set<string>();
const loadedCssUrls = new Set<string>();

const appendStylesheetLink = (href: string) => {
    if (loadedCssUrls.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    loadedCssUrls.add(href);
};

export async function ensureMarketingTypographyFontLoaded(
    font: MarketingTypographyFontOption,
): Promise<void> {
    if (typeof document === 'undefined') return;

    if (font.cssUrl) {
        appendStylesheetLink(font.cssUrl);
    }

    if (font.fileDataUrl && !loadedFontIds.has(font.id)) {
        const face = new FontFace(font.label, `url(${font.fileDataUrl})`);
        await face.load();
        document.fonts.add(face);
        loadedFontIds.add(font.id);
    }
}
