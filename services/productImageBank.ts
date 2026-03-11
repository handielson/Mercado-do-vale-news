import { supabase } from './supabase';
import imageCompression from 'browser-image-compression';

const BUCKET = 'product-images';

// ─── Nova estrutura de caminho ────────────────────────────────────────────────
// Pasta = SKU  →  products/{SKU}/nome-produto_cor_01.webp
// O filename usa hífens no nome do produto e underscores antes de cor e número.
// Exemplo:  products/CCSRMN70AZES/capa-de-silicone-realme_preto_01.webp
// ─────────────────────────────────────────────────────────────────────────────

export interface ImageBankEntry {
    path: string;       // caminho no bucket: products/{sku}/{seo-name}
    url: string;        // URL pública permanente
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

/** Converte qualquer File de imagem para WebP comprimido */
async function toWebP(file: File, maxPx = 1000): Promise<File> {
    const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: maxPx,
        useWebWorker: true,
        fileType: 'image/webp',
    });
    return new File([compressed], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
}

/**
 * Gera slug SEO a partir de um texto.
 * "Capa de Silicone Realme Note 70" → "capa-de-silicone-realme-note-70"
 */
export function toSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ─── NOVO PADRÃO: {SKU}_{num}.webp ───────────────────────────────────────────
// Exemplo: XRN14-T025_01.webp
// Vantagem: basta renomear a foto para SKU_01.jpg antes do upload.
// O SKU pode conter hifens. O separador antes do número é sempre underscore.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera filename no novo padrão: "{SKU}_{num}.webp"
 * Ex: buildSkuFilename('XRN14-T025', 2) → "XRN14-T025_02.webp"
 */
export function buildSkuFilename(sku: string, order: number): string {
    return `${sku.toUpperCase()}_${String(order).padStart(2, '0')}.webp`;
}

/**
 * Parseia o novo padrão: "{SKU}_{num}.{ext}"
 * Divide pelo último underscore → parte antes = SKU, parte depois = número.
 * Ex: "XRN14-T025_02.webp" → { sku: "XRN14-T025", order: 2 }
 */
export function parseSkuFilename(filename: string): { sku: string; order: number } | null {
    const base = filename.replace(/\.[^.]+$/, ''); // remove extensão
    const lastUnderscore = base.lastIndexOf('_');
    if (lastUnderscore === -1) return null;

    const skuPart = base.substring(0, lastUnderscore);
    const numPart = base.substring(lastUnderscore + 1);
    const order = parseInt(numPart, 10);

    if (!skuPart || isNaN(order)) return null;
    return { sku: skuPart.toUpperCase(), order };
}

// ─── FORMATOS ANTIGOS (mantidos para retrocompatibilidade) ────────────────────

/**
 * Gera SEO filename legado: "{produto-slug}_{cor}_{numero}.webp"
 */
export function buildSeoFilename(productName: string, color: string, order: number): string {
    const nameSlug = toSlug(productName);
    const colorSlug = toSlug(color);
    const num = String(order).padStart(2, '0');
    return `${nameSlug}_${colorSlug}_${num}.webp`;
}

/**
 * Parseia formato SEO legado: "{qualquer-coisa}_{cor}_{numero}.ext"
 * O SKU vem do caminho (pasta pai), não do filename.
 */
export function parseSeoFilename(filename: string): { color: string; order: number } | null {
    const normalized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const base = normalized.replace(/\.[^.]+$/, '');
    const parts = base.split('_');
    if (parts.length < 3) return null;

    const orderStr = parts[parts.length - 1];
    const order = parseInt(orderStr, 10);
    if (isNaN(order)) return null;

    const color = parts[parts.length - 2];
    if (!color) return null;

    return { color: color.toUpperCase(), order };
}

/**
 * Compatibilidade retroativa com formato antigo SKU_COR_NUM (raiz do bucket).
 */
export function parseImageFilename(filename: string): { sku: string; color: string; order: number } | null {
    const normalized = filename.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const base = normalized.replace(/\.[^.]+$/, '');
    const parts = base.split('_');
    if (parts.length < 3) return null;

    const orderStr = parts[parts.length - 1];
    const order = parseInt(orderStr, 10);
    if (isNaN(order)) return null;

    const color = parts[parts.length - 2];
    const sku = parts.slice(0, parts.length - 2).join('_');
    if (!sku || !color) return null;

    return { sku: sku.toUpperCase(), color: color.toUpperCase(), order };
}


/**
 * Faz upload de imagens para o Supabase Storage.
 *
 * MODO 1 — Upload em massa (sem contexto): o filename já deve estar no padrão
 *   "{SKU}_{num}.jpg"  →  salvo como  products/{SKU}/{SKU}_{num}.webp
 *   Ex: "XRN14-T025_01.jpg" → products/XRN14-T025/XRN14-T025_01.webp
 *
 * MODO 2 — Upload com contexto (UI do gerador): sku + productName + cor + startOrder
 *   Salva como products/{SKU}/{produto-slug}_{cor}_{num}.webp  (formato SEO legado)
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
            // Modo 2: contexto fornecido pela UI
            sku = context.sku.toUpperCase();
            color = (context.color || 'PADRAO').toUpperCase();
            order = (context.startOrder ?? 1) + i;
            webpName = buildSeoFilename(context.productName, color, order);
        } else {
            // Modo 1 (novo padrão): "{SKU}_{num}.ext"
            const parsed = parseSkuFilename(file.name);
            if (!parsed) {
                result.errors.push({
                    file: file.name,
                    reason: 'Nome inválido. Renomeie para o padrão: SKU_01.jpg (ex: XRN14-T025_01.jpg)'
                });
                continue;
            }
            sku = parsed.sku;
            color = '';
            order = parsed.order;
            webpName = buildSkuFilename(sku, order);
        }


        const storagePath = `products/${sku}/${webpName}`;

        try {
            const webpFile = await toWebP(file);
            const webpFileNamed = new File([webpFile], webpName, { type: 'image/webp' });

            const { error } = await supabase.storage
                .from(BUCKET)
                .upload(storagePath, webpFileNamed, { upsert: true, contentType: 'image/webp' });

            if (error) throw new Error(error.message);

            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
            result.success.push({
                path: storagePath,
                url: pub.publicUrl,
                sku,
                color,
                order,
                filename: webpName,
            });
        } catch (err: any) {
            result.errors.push({ file: file.name, reason: err.message });
        }
    }

    onProgress?.(files.length, files.length);
    return result;
}

/** Lista todas as imagens do banco agrupadas por SKU (nova estrutura de pastas) */
export async function listAllBankImages(): Promise<ImageBankEntry[]> {
    const { data: folders, error: folderError } = await supabase.storage
        .from(BUCKET)
        .list('products', { limit: 200 });

    if (folderError || !folders) return [];

    const all: ImageBankEntry[] = [];

    for (const folder of folders) {
        if (folder.name.endsWith('.webp')) {
            // Arquivo legado no raiz do bucket
            const parsed = parseImageFilename(folder.name);
            if (!parsed) continue;
            const path = `products/${folder.name}`;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
            all.push({ path, url: pub.publicUrl, ...parsed, filename: folder.name });
            continue;
        }

        // É uma pasta — lista seu conteúdo
        const sku = folder.name.toUpperCase();
        const { data: files, error: filesError } = await supabase.storage
            .from(BUCKET)
            .list(`products/${folder.name}`, { limit: 100 });

        if (filesError || !files) continue;

        for (const f of files) {
            if (!f.name.endsWith('.webp')) continue;

            // Tenta novo padrão {SKU}_{num}.webp primeiro
            const skuParsed = parseSkuFilename(f.name);
            const path = `products/${folder.name}/${f.name}`;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

            if (skuParsed) {
                all.push({ path, url: pub.publicUrl, sku, color: '', order: skuParsed.order, filename: f.name });
            } else {
                // Fallback para formato SEO legado {nome}_{cor}_{num}.webp
                const seoParsed = parseSeoFilename(f.name);
                if (!seoParsed) continue;
                all.push({ path, url: pub.publicUrl, sku, color: seoParsed.color, order: seoParsed.order, filename: f.name });
            }
        }
    }

    return all;
}

/** Lista imagens de um SKU específico */
export async function listImagesForSku(sku: string): Promise<ImageBankEntry[]> {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(`products/${sku.toUpperCase()}`, { limit: 100 });

    if (error || !data) return [];

    return data
        .filter(f => f.name.endsWith('.webp'))
        .map(f => {
            // Tenta novo padrão {SKU}_{num}.webp
            const skuParsed = parseSkuFilename(f.name);
            const path = `products/${sku.toUpperCase()}/${f.name}`;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
            if (skuParsed) {
                return { path, url: pub.publicUrl, sku: sku.toUpperCase(), color: '', order: skuParsed.order, filename: f.name };
            }
            // Fallback formato SEO legado
            const seoParsed = parseSeoFilename(f.name);
            return {
                path, url: pub.publicUrl,
                sku: sku.toUpperCase(),
                color: seoParsed?.color ?? '',
                order: seoParsed?.order ?? 0,
                filename: f.name,
            };
        })
        .sort((a, b) => a.order - b.order);
}

/** Deleta uma imagem do banco pelo path */
export async function deleteImageFromBank(path: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(error.message);
}

/** Sincroniza imagens do banco com os produtos correspondentes */
export async function syncImagesToProducts(
    _companyId: string,
    skus: string[]
): Promise<{ updated: number; notFound: string[] }> {
    let updated = 0;
    const notFound: string[] = [];

    for (const sku of skus) {
        const images = await listImagesForSku(sku);
        if (images.length === 0) { notFound.push(sku); continue; }

        const urls = images
            .sort((a, b) => a.color.localeCompare(b.color) || a.order - b.order)
            .map(img => img.url);

        // Usa RPC com SECURITY DEFINER para contornar o RLS em products
        const { error } = await supabase.rpc('sync_product_images', {
            p_sku: sku,
            p_urls: urls,
        });

        if (error) { notFound.push(sku); continue; }
        updated++;
    }

    return { updated, notFound };
}
