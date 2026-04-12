/**
 * vpsClient.ts
 * Cliente HTTP para a API da VPS (https://api.xiaomipetrolina.com.br)
 * Substitui chamadas ao Supabase gradualmente conforme as tabelas migram.
 */

import { supabase } from './supabase';

const VPS_PROXY_BASE = '/api/vps-proxy';

function buildProxyUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${VPS_PROXY_BASE}?path=${encodeURIComponent(normalized)}`;
}

async function buildHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        const res = await fetch(buildProxyUrl(path), {
            headers: await buildHeaders(),
            cache: 'no-store',
        });
        return handleResponse<T>(res);
    },

    /**
     * POST /resource  (body JSON)
     */
    post: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(buildProxyUrl(path), {
            method: 'POST',
            headers: await buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    /**
     * PATCH /resource/:id  (body JSON)
     */
    patch: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(buildProxyUrl(path), {
            method: 'PATCH',
            headers: await buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    /**
     * PUT /resource/:id  (body JSON)
     */
    put: async <T>(path: string, body: unknown): Promise<T> => {
        const res = await fetch(buildProxyUrl(path), {
            method: 'PUT',
            headers: await buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(res);
    },

    /**
     * DELETE /resource/:id
     */
    delete: async (path: string): Promise<void> => {
        const headers = await buildHeaders();
        const res = await fetch(buildProxyUrl(path), {
            method: 'DELETE',
            headers,
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
        const headers = await buildHeaders({});
        delete (headers as Record<string, string>)['Content-Type'];
        const res = await fetch(buildProxyUrl(path), {
            method: 'POST',
            headers,
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
            supabase.auth.getSession().then(({ data }) => {
                const token = data.session?.access_token;
                const xhr = new XMLHttpRequest();
                xhr.open('POST', buildProxyUrl(path));
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
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
            }).catch(reject);
        });
    },
};

