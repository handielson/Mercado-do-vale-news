import { compressImage } from '../utils/image-compression';
import { getAuthSessionToken } from './authSession';
import { buildVpsUrl, getVpsSyncHeaders } from './vpsProxyBase';

export function uploadCompressedProductImage(productId: string, file: Blob, filename: string, token: string | null) {
    const form = new FormData();
    form.append('file', file, filename);
    return fetch(buildVpsUrl(`/products/${productId}/upload-image`, { method: 'POST' }), {
        method: 'POST', headers: { ...getVpsSyncHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form,
    });
}

export async function uploadProductImages(productId: string, files: File[]): Promise<string[]> {
    const token = await getAuthSessionToken();
    const images: string[] = [];
    for (const file of files) {
        if (!file.type.startsWith('image/')) throw new Error('Selecione apenas arquivos de imagem.');
        const response = await uploadCompressedProductImage(productId, await compressImage(file), file.name, token);
        if (!response.ok) throw new Error('Não foi possível enviar a foto. Tente novamente.');
        const data = await response.json();
        if (typeof data.url !== 'string' || !data.url) throw new Error('O envio não confirmou o endereço da foto.');
        images.push(data.url);
    }
    return images;
}
