import { getAuthSessionToken } from './authSession';
import { VPS_DIRECT_BASE_URL, buildVpsUrl, getVpsSyncHeaders } from './vpsProxyBase';

type UploadResult = { ok?: boolean; uploadId?: string; name?: string; url?: string; status?: string; error?: string | null; detail?: string | null; debug?: unknown };
export class SynologyUploadError extends Error {
    debug?: unknown;
    uploadFailed: boolean;
    constructor(message: string, debug?: unknown, uploadFailed = false) {
        super(message); this.name = 'SynologyUploadError'; this.debug = debug; this.uploadFailed = uploadFailed;
    }
}
const message = (data: UploadResult | null, fallback: string) => `${data?.error || fallback}${data?.detail ? ` (${data.detail})` : ''}`;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function validateProductVideo(file: Pick<File, 'name' | 'size' | 'type'>) {
    if (!/\.mp4$/i.test(file.name) || (file.type && file.type !== 'video/mp4')) throw new Error('Selecione um vídeo MP4.');
    if (file.size <= 0 || file.size > 500 * 1024 * 1024) throw new Error('O vídeo deve ter conteúdo e no máximo 500 MB.');
}

// Shared with the existing product-card uploader: bypass the site proxy's file
// limit, then wait for the NAS job (HTTP 200 only confirms receipt by the VPS).
export const uploadVideoWithProgress = (formData: FormData, token: string | undefined, onProgress: (progress: number) => void) => new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${VPS_DIRECT_BASE_URL}/synology/upload?folder=videos`);
    Object.entries(getVpsSyncHeaders()).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(Math.max(1, Math.min(90, Math.round(event.loaded / event.total * 90))));
    };
    xhr.onerror = () => reject(new Error('Falha de rede ao enviar o vídeo para a VPS'));
    xhr.ontimeout = () => reject(new Error('Tempo esgotado ao enviar o vídeo para a VPS'));
    xhr.onload = () => {
        let payload: UploadResult | null = null;
        try { payload = JSON.parse(xhr.responseText); } catch { /* Invalid response is not a confirmed upload. */ }
        if (xhr.status < 200 || xhr.status >= 300) return reject(new SynologyUploadError(message(payload, `Erro HTTP ${xhr.status} no upload para a VPS`), payload?.debug));
        if (!payload) return reject(new Error('A VPS não confirmou o recebimento do vídeo.'));
        resolve(payload);
    };
    xhr.send(formData);
});

export const pollSynologyUploadStatus = async (uploadId: string, token: string | undefined) => {
    const headers = { ...getVpsSyncHeaders(), ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'application/json' };
    for (let attempt = 0; attempt < 90; attempt += 1) {
        const res = await fetch(buildVpsUrl(`/synology/upload-status?id=${encodeURIComponent(uploadId)}`, { method: 'GET' }), { headers, cache: 'no-store' });
        const status = await res.json().catch(() => null) as UploadResult | null;
        if (!res.ok) throw new SynologyUploadError(message(status, 'Não foi possível consultar o status do upload'), status?.debug);
        if (status?.status === 'success') return status;
        if (status?.status === 'error') throw new SynologyUploadError(message(status, 'Falha ao gravar vídeo no Synology'), status.debug, true);
        await wait(1500);
    }
    throw new Error('O Synology ainda não confirmou o upload. Tente salvar novamente para consultar o envio pendente.');
};

export async function uploadProductVideo(file: File, sku: string, options: {
    uploadId?: string; onAccepted?: (uploadId: string) => void;
    onProgress?: (progress: number, message: string) => void;
} = {}): Promise<string> {
    validateProductVideo(file);
    const code = String(sku || '').trim();
    if (!code || /[\s/\\?#\u0000-\u001f]/u.test(code)) throw new Error('O SKU definitivo da variação não é válido para nomear o vídeo.');
    const token = await getAuthSessionToken();
    let uploadId = options.uploadId;
    if (!uploadId) {
        const form = new FormData();
        form.append('file', file, `${code}.mp4`);
        const result = await uploadVideoWithProgress(form, token, pct => options.onProgress?.(pct, `Enviando vídeo de ${code}: ${pct}%`));
        if (!result.ok || !result.uploadId) throw new Error('A VPS não confirmou o job de envio do vídeo.');
        uploadId = result.uploadId;
        options.onAccepted?.(uploadId);
    }
    options.onProgress?.(92, `Gravando vídeo de ${code} no Synology...`);
    const status = await pollSynologyUploadStatus(uploadId, token);
    if (!status.url) throw new Error('O Synology não confirmou o endereço do vídeo.');
    options.onProgress?.(100, `Vídeo de ${code} enviado.`);
    return status.url;
}
