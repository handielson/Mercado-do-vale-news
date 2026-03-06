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

/**
 * Gera o SEO filename para uma imagem:
 * "{produto-slug}_{cor}_{numero}.webp"
 * Exemplo: "capa-de-silicone-realme-note-70_preto_01.webp"
 */
export function buildSeoFilename(productName: string, color: string, order: number): string {
    const nameSlug = toSlug(productName);
    const colorSlug = toSlug(color);
    const num = String(order).padStart(2, '0');
    return `${nameSlug}_${colorSlug}_${num}.webp`;
}

/**
 * Parseia o SEO filename: "{qualquer-coisa}_{cor}_{numero}.ext"
 * O SKU vem do caminho (pasta pai), não do filename.
 */
export function parseSeoFilename(filename: string): { color: string; order: number } | null {
    // Normaliza: remove acentos, lowercase
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
 * Mantido para compatibilidade retroativa com o formato antigo SKU_COR_NUM.
 */
export function parseImageFilename(filename: string): { sku: string; color: string; order: number } | null {
    // Normaliza: remove acentos
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
 * Faz upload de imagens para o Supabase Storage em formato SEO.
 * O filename do arquivo enviado pode ser qualquer nome de imagem.
 * O sistema salva como: products/{sku}/{seoFilename}
 *
 * @param files  Arquivos a enviar
 * @param sku    SKU do produto (vem do contexto de upload na UI)
 * @param productName  Nome do produto (para gerar o slug SEO)
 * @param colorOverride  Cor (opcional — se não passada, tenta ler do filename)
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

        if (context) {
            // Modo SEO: contexto passado pela UI
            sku = context.sku.toUpperCase();
            color = (context.color || 'PADRAO').toUpperCase();
            order = (context.startOrder ?? 1) + i;
        } else {
            // Modo legado: parseia do filename (SKU_COR_NUM)
            const parsed = parseImageFilename(file.name);
            if (!parsed) {
                result.errors.push({ file: file.name, reason: 'Nome inválido. Use o gerador ou forneça um SKU.' });
                continue;
            }
            sku = parsed.sku;
            color = parsed.color;
            order = parsed.order;
        }

        const webpName = context
            ? buildSeoFilename(context.productName, color, order)
            : `${sku}_${color}_${String(order).padStart(2, '0')}.webp`;

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
    // Lista as "pastas" (SKUs) dentro de products/
    const { data: folders, error: folderError } = await supabase.storage
        .from(BUCKET)
        .list('products', { limit: 200 });

    if (folderError || !folders) return [];

    const all: ImageBankEntry[] = [];

    for (const folder of folders) {
        // Pode ser pasta (id null) ou arquivo legado
        if (folder.name.endsWith('.webp')) {
            // Arquivo legado no raiz: tenta parsear pelo filename antigo
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
            const parsed = parseSeoFilename(f.name);
            if (!parsed) continue;
            const path = `products/${folder.name}/${f.name}`;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
            all.push({
                path,
                url: pub.publicUrl,
                sku,
                color: parsed.color,
                order: parsed.order,
                filename: f.name,
            });
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
            const parsed = parseSeoFilename(f.name);
            const path = `products/${sku.toUpperCase()}/${f.name}`;
            const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
            return {
                path,
                url: pub.publicUrl,
                sku: sku.toUpperCase(),
                color: parsed?.color ?? '',
                order: parsed?.order ?? 0,
                filename: f.name,
            };
        })
        .sort((a, b) => a.color.localeCompare(b.color) || a.order - b.order);
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
