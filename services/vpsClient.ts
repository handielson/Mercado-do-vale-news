/**
 * vpsClient.ts
 * Cliente HTTP para a API da VPS (https://api.xiaomipetrolina.com.br)
 * Substitui chamadas ao Supabase gradualmente conforme as tabelas migram.
 */

const VPS_BASE = 'https://api.xiaomipetrolina.com.br';
const VPS_KEY = import.meta.env.VITE_VPS_SYNC_KEY;

function buildHeaders(extra?: Record<string, string>): HeadersInit {
    return {
        'Content-Type': 'application/json',
        'X-API-Key': VPS_KEY ?? '',
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
            headers: buildHeaders(),
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
            headers: { 'X-API-Key': VPS_KEY ?? '' }, // sem Content-Type, browser define o boundary
            body: formData,
        });
        return handleResponse<T>(res);
    },
};
