import imageCompression from 'browser-image-compression';

const VPS_BASE  = import.meta.env.VITE_VPS_BASE_URL  || 'https://api.xiaomipetrolina.com.br';
const SYNC_KEY  = import.meta.env.VITE_VPS_SYNC_KEY  || '';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ImageBankEntry {
    path: string;     // relativo ao uploads dir: products/{SKU}/{filename}.webp
    url: string;      // URL pública: https://api.xiaomipetrolina.com.br/images/products/{SKU}/...
    sku: string;
    color: string;
    order: number;
    filename: string;
}

export interface UploadResult {
    success: ImageBankEntry[];
    errors: { file: string; reason: string }[];
    skipped: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Comprime e converte para WebP (roda no browser) */
async function toWebP(file: File, maxPx = 1000): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: maxPx,
        useWebWorker: true,
        fileType: 'image/webp',
    });
    return new File([compressed], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
}

/** SEO slug */
export function toSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export function buildSkuFilename(sku: string, order: number): string {
    return `${sku.toUpperCase()}_${String(order).padStart(2, '0')}.webp`;
}

export function parseSkuFilename(filename: string): { sku: string; order: number } | null {
    const base = filename.replace(/\.[^.]+$/, '');
    const lastUnderscore = base.lastIndexOf('_');
    if (lastUnderscore === -1) return null;
    const skuPart = base.substring(0, lastUnderscore);
    const order = parseInt(base.substring(lastUnderscore + 1), 10);
    if (!skuPart || isNaN(order)) return null;
    return { sku: skuPart.toUpperCase(), order };
}

export function buildSeoFilename(productName: string, color: string, order: number): string {
    return `${toSlug(productName)}_${toSlug(color)}_${String(order).padStart(2, '0')}.webp`;
}

export function parseSeoFilename(filename: string): { color: string; order: number } | null {
    const base = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\.[^.]+$/, '');
    const parts = base.split('_');
    if (parts.length < 3) return null;
    const order = parseInt(parts[parts.length - 1], 10);
    if (isNaN(order)) return null;
    const color = parts[parts.length - 2];
    return color ? { color: color.toUpperCase(), order } : null;
}

/** Retrocompat with old root-bucket format */
export function parseImageFilename(filename: string): { sku: string; color: string; order: number } | null {
    const base = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\.[^.]+$/, '');
    const parts = base.split('_');
    if (parts.length < 3) return null;
    const order = parseInt(parts[parts.length - 1], 10);
    if (isNaN(order)) return null;
    const color = parts[parts.length - 2];
    const sku = parts.slice(0, parts.length - 2).join('_');
    if (!sku || !color) return null;
    return { sku: sku.toUpperCase(), color: color.toUpperCase(), order };
}

// ─── VPS API calls ─────────────────────────────────────────────────────────

/**
 * Upload de imagens para a VPS.
 * Comprime para WebP no browser antes de enviar.
 */
export async function uploadImagesToBank(
    files: File[],
    onProgress?: (done: number, total: number) => void,
    context?: { sku: string; productName: string; color?: string; startOrder?: number }
): Promise<UploadResult> {
    const result: UploadResult = { success: [], errors: [], skipped: [] };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        onProgress?.(i, files.length);

        let sku: string;
        let color: string;
        let order: number;
        let webpName: string;

        if (context) {
            sku      = context.sku.toUpperCase();
            color    = (context.color || 'PADRAO').toUpperCase();
            order    = (context.startOrder ?? 1) + i;
            webpName = buildSeoFilename(context.productName, color, order);
        } else {
            const parsed = parseSkuFilename(file.name);
            if (!parsed) {
                result.errors.push({ file: file.name, reason: 'Nome inválido. Use: SKU_01.jpg' });
                continue;
            }
            sku      = parsed.sku;
            color    = '';
            order    = parsed.order;
            webpName = buildSkuFilename(sku, order);
        }

        const storagePath = `products/${sku}/${webpName}`;

        try {
            const webpFile = await toWebP(file);
            const webpNamed = new File([webpFile], webpName, { type: 'image/webp' });

            const formData = new FormData();
            formData.append('file', webpNamed);
            formData.append('path', storagePath);

            const res = await fetch(`${VPS_BASE}/images/upload`, {
                method: 'POST',
                headers: { 'X-Sync-Key': SYNC_KEY },
                body: formData,
            });

            if (!res.ok) throw new Error((await res.json()).error || res.statusText);

            const data = await res.json();
            result.success.push({ path: storagePath, url: data.url, sku, color, order, filename: webpName });
        } catch (err: any) {
            result.errors.push({ file: file.name, reason: err.message });
        }
    }

    onProgress?.(files.length, files.length);
    return result;
}

/** Lista TODOS os images: VPS filesystem (novos) + Supabase Storage (existentes) */
export async function listAllBankImages(): Promise<ImageBankEntry[]> {
    const [vpsImages, supabaseImages] = await Promise.all([
        _listVpsImages('products'),
        _listSupabaseImages(),
    ]);

    // Dedup: VPS tem prioridade sobre Supabase (mesmo path)
    const seen = new Set<string>(vpsImages.map(i => i.path));
    const merged = [
        ...vpsImages,
        ...supabaseImages.filter(i => !seen.has(i.path)),
    ];
    return merged;
}

/** Lista imagens de um SKU específico (VPS + Supabase) */
export async function listImagesForSku(sku: string): Promise<ImageBankEntry[]> {
    const [vpsImgs, supImgs] = await Promise.all([
        _listVpsImages(`products/${sku.toUpperCase()}`),
        _listSupabaseImagesForSku(sku.toUpperCase()),
    ]);
    const seen = new Set<string>(vpsImgs.map(i => i.path));
    const merged = [...vpsImgs, ...supImgs.filter(i => !seen.has(i.path))];
    return merged.sort((a, b) => a.order - b.order);
}

/** Deleta imagem: tenta VPS primeiro, se não existir deleta no Supabase Storage */
export async function deleteImageFromBank(filePath: string): Promise<void> {
    // Tenta VPS
    const res = await fetch(`${VPS_BASE}/images/file`, {
        method: 'DELETE',
        headers: { 'X-Sync-Key': SYNC_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
    });
    if (res.ok) return;
    if (res.status !== 404) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Erro ao deletar imagem na VPS');
    }
    // Fallback: Supabase Storage
    const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
    if (error) throw new Error(error.message);
}

// ─── Helpers privados ──────────────────────────────────────────────────────

async function _listVpsImages(prefix: string): Promise<ImageBankEntry[]> {
    try {
        const res = await fetch(`${VPS_BASE}/images/list?prefix=${encodeURIComponent(prefix)}`);
        if (!res.ok) return [];
        const files: { path: string; url: string; filename: string }[] = await res.json();
        return files.map(f => {
            const parts = f.path.split('/');
            const sku = (parts[1] || '').toUpperCase();
            const skuParsed = parseSkuFilename(f.filename);
            if (skuParsed) return { ...f, sku, color: '', order: skuParsed.order };
            const seoParsed = parseSeoFilename(f.filename);
            return { ...f, sku, color: seoParsed?.color ?? '', order: seoParsed?.order ?? 0 };
        });
    } catch { return []; }
}

async function _listSupabaseImages(): Promise<ImageBankEntry[]> {
    const { data: folders, error } = await supabase.storage
        .from(BUCKET).list('products', { limit: 200 });
    if (error || !folders) return [];

    const all: ImageBankEntry[] = [];
    for (const folder of folders) {
        if (folder.name.endsWith('.webp')) {
            const parsed = parseImageFilename(folder.name);
            if (!parsed) continue;
            const path = `products/${folder.name}`;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
            all.push({ path, url: pub.publicUrl, ...parsed, filename: folder.name });
            continue;
        }
        const sku = folder.name.toUpperCase();
        const { data: files } = await supabase.storage
            .from(BUCKET).list(`products/${folder.name}`, { limit: 100 });
        if (!files) continue;
        for (const f of files) {
            if (!f.name.endsWith('.webp')) continue;
            const path = `products/${folder.name}/${f.name}`;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
            const skuParsed = parseSkuFilename(f.name);
            if (skuParsed) {
                all.push({ path, url: pub.publicUrl, sku, color: '', order: skuParsed.order, filename: f.name });
            } else {
                const seoParsed = parseSeoFilename(f.name);
                if (!seoParsed) continue;
                all.push({ path, url: pub.publicUrl, sku, color: seoParsed.color, order: seoParsed.order, filename: f.name });
            }
        }
    }
    return all;
}

async function _listSupabaseImagesForSku(sku: string): Promise<ImageBankEntry[]> {
    const { data } = await supabase.storage
        .from(BUCKET).list(`products/${sku}`, { limit: 100 });
    if (!data) return [];
    return data.filter(f => f.name.endsWith('.webp')).map(f => {
        const path = `products/${sku}/${f.name}`;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const skuParsed = parseSkuFilename(f.name);
        if (skuParsed) return { path, url: pub.publicUrl, sku, color: '', order: skuParsed.order, filename: f.name };
        const seoParsed = parseSeoFilename(f.name);
        return { path, url: pub.publicUrl, sku, color: seoParsed?.color ?? '', order: seoParsed?.order ?? 0, filename: f.name };
    });
}
