/**
 * vpsClient.ts
 * Cliente HTTP para a API da VPS (https://api.xiaomipetrolina.com.br)
 * Substitui chamadas ao Supabase gradualmente conforme as tabelas migram.
 */

const VPS_BASE = import.meta.env.DEV
    ? '/vps-proxy'
    : (import.meta.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br');

const VPS_KEY = import.meta.env.VITE_VPS_SYNC_KEY;

function buildHeaders(extra?: Record<string, string>): HeadersInit {
    return {
        'Content-Type': 'application/json',
        'x-sync-key': VPS_KEY ?? '', // servidor VPS verifica este header em requireSyncKey
        ...extra,
    };
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`[VPS] ${res.status} ${res.url} — ${text}`);
    }
    return res.json() as Promise<T>;
}

export const vpsClient = {
    /**
     * GET /resource
     */
    get: async <T>(path: string): Promise<T> => {
        const res = await fetch(`${VPS_BASE}${path}`, {
            headers: buildHeaders(),
            cache: 'no-store',
        });
        return handleResponse<T>(res);
    },

    /**
     * POST /resource  (body JSON)
     */
    post: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(`${VPS_BASE}${path}`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    /**
     * PATCH /resource/:id  (body JSON)
     */
    patch: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(`${VPS_BASE}${path}`, {
            method: 'PATCH',
            headers: buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    /**
     * PUT /resource/:id  (body JSON)
     */
    put: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(`${VPS_BASE}${path}`, {
            method: 'PUT',
            headers: buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    /**
     * DELETE /resource/:id
     */
    delete: async (path: string): Promise<void> => {
        const res = await fetch(`${VPS_BASE}${path}`, {
            method: 'DELETE',
            headers: { 'x-sync-key': VPS_KEY ?? '' }, // sem Content-Type para evitar FST_ERR_CTP_EMPTY_JSON_BODY
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            throw new Error(`[VPS] ${res.status} ${res.url} — ${text}`);
        }
    },

    /**
     * POST multipart/form-data (upload de arquivo)
     * Usado para upload de banners e imagens.
     */
    upload: async <T>(path: string, formData: FormData): Promise<T> => {
        const res = await fetch(`${VPS_BASE}${path}`, {
            method: 'POST',
            headers: { 'x-sync-key': VPS_KEY ?? '' }, // sem Content-Type, browser define o boundary
            body: formData,
        });
        return handleResponse<T>(res);
    },

    /**
     * POST multipart/form-data com rastreamento de progresso via XHR.
     * onProgress: (pct: 0-100, phase: 'sending'|'processing') => void
     */
    uploadWithProgress: <T>(path: string, formData: FormData, onProgress: (pct: number, phase: 'sending' | 'processing') => void): Promise<T> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${VPS_BASE}${path}`);
            xhr.setRequestHeader('x-sync-key', VPS_KEY ?? '');
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), 'sending');
            };
            xhr.upload.onloadend = () => onProgress(100, 'processing');
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(undefined as T); }
                } else {
                    reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText}`));
                }
            };
            xhr.onerror = () => reject(new Error('Erro de rede'));
            xhr.send(formData);
        });
    },
};

