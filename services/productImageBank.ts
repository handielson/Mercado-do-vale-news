import imageCompression from 'browser-image-compression';
import { supabase } from './supabase';

const VPS_PROXY_BASE = '/api/vps-proxy';

function proxyUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${VPS_PROXY_BASE}?path=${encodeURIComponent(normalized)}`;
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
    };
}

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

            const res = await fetch(proxyUrl('/images/upload'), {
                method: 'POST',
                headers: await authHeaders(),
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

/** Lista todas as imagens do banco (VPS filesystem) */
export async function listAllBankImages(): Promise<ImageBankEntry[]> {
    try {
        const res = await fetch(proxyUrl('/images/list?prefix=products'), {
            cache: 'no-store',
            headers: await authHeaders(),
        });
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

/** Lista imagens de um SKU específico (VPS filesystem) */
export async function listImagesForSku(sku: string): Promise<ImageBankEntry[]> {
    try {
        const res = await fetch(proxyUrl(`/images/list?prefix=products/${sku.toUpperCase()}`), {
            cache: 'no-store',
            headers: await authHeaders(),
        });
        if (!res.ok) return [];
        const files: { path: string; url: string; filename: string }[] = await res.json();
        return files.map(f => {
            const skuParsed = parseSkuFilename(f.filename);
            if (skuParsed) return { ...f, sku: sku.toUpperCase(), color: '', order: skuParsed.order };
            const seoParsed = parseSeoFilename(f.filename);
            return { ...f, sku: sku.toUpperCase(), color: seoParsed?.color ?? '', order: seoParsed?.order ?? 0 };
        }).sort((a, b) => a.order - b.order);
    } catch { return []; }
}

/** Deleta uma imagem da VPS pelo path */
export async function deleteImageFromBank(filePath: string): Promise<void> {
    const res = await fetch(proxyUrl('/images/file'), {
        method: 'DELETE',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ path: filePath }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Erro ao deletar imagem');
    }
}
