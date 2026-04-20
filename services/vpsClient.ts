/**
 * vpsClient.ts
 * Cliente HTTP para a API da VPS (https://api.xiaomipetrolina.com.br)
 * Substitui chamadas ao Supabase gradualmente conforme as tabelas migram.
 */

import { supabase } from './supabase';
import {
    IS_VPS_PROXY_ROUTE,
    buildVpsUrl,
    getVpsSyncHeaders,
    getVpsSyncKey,
} from './vpsProxyBase';

const CHECKPOINT_COOLDOWN_MS = 60_000;

let checkpointBlockedUntil = 0;
let hasWarnedMissingSyncKey = false;

function isCheckpointBlockedNow(): boolean {
    return Date.now() < checkpointBlockedUntil;
}

function markCheckpointBlocked(): void {
    checkpointBlockedUntil = Date.now() + CHECKPOINT_COOLDOWN_MS;
}

function looksLikeVercelSecurityCheckpoint(text: string): boolean {
    const lower = (text || '').toLowerCase();
    return lower.includes('vercel security checkpoint') || lower.includes("we're verifying your browser");
}

function summarizeErrorBody(text: string): string {
    const trimmed = (text || '').trim();
    if (!trimmed) return '';
    if (looksLikeVercelSecurityCheckpoint(trimmed)) {
        return 'Vercel Security Checkpoint (bloqueio anti-bot temporario)';
    }
    if (trimmed.length > 240) return `${trimmed.slice(0, 240)}...`;
    return trimmed;
}

async function buildHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const syncKey = getVpsSyncKey();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getVpsSyncHeaders(),
        ...extra,
    };

    // Em dev local o proxy do Vite ainda pode suprir os headers.
    // Em producao direta para a VPS, o sync key precisa existir no cliente.
    if (!syncKey && !hasWarnedMissingSyncKey && import.meta.env.DEV) {
        hasWarnedMissingSyncKey = true;
        console.warn('[vpsClient] âš ï¸ x-sync-key nÃ£o configurado. Verifique VITE_VPS_SYNC_KEY');
    }

    return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const summary = summarizeErrorBody(text);
        if (IS_VPS_PROXY_ROUTE && res.status === 403 && looksLikeVercelSecurityCheckpoint(text)) {
            markCheckpointBlocked();
        }
        throw new Error(`[VPS] ${res.status} ${res.url}${summary ? ` â€” ${summary}` : ''}`);
    }
    return res.json() as Promise<T>;
}

function assertCheckpointNotBlocked(path: string): void {
    if (!IS_VPS_PROXY_ROUTE) return;
    if (isCheckpointBlockedNow()) {
        const remaining = Math.max(0, Math.ceil((checkpointBlockedUntil - Date.now()) / 1000));
        throw new Error(`[VPS] 403 ${buildVpsUrl(path)} â€” Vercel Security Checkpoint ativo (aguarde ${remaining}s)`);
    }
}

export const vpsClient = {
    /**
     * GET /resource
     */
    get: async <T>(path: string): Promise<T> => {
        assertCheckpointNotBlocked(path);
        const res = await fetch(buildVpsUrl(path), {
            headers: await buildHeaders(),
            cache: 'no-store',
        });
        return handleResponse<T>(res);
    },

    /**
     * POST /resource  (body JSON)
     */
    post: async <T>(path: string, body: unknown): Promise<T> => {
        assertCheckpointNotBlocked(path);
        const res = await fetch(buildVpsUrl(path), {
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
        assertCheckpointNotBlocked(path);
        const res = await fetch(buildVpsUrl(path), {
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
        assertCheckpointNotBlocked(path);
        const res = await fetch(buildVpsUrl(path), {
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
        assertCheckpointNotBlocked(path);
        const headers = await buildHeaders();
        const res = await fetch(buildVpsUrl(path), {
            method: 'DELETE',
            headers,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            const summary = summarizeErrorBody(text);
            if (IS_VPS_PROXY_ROUTE && res.status === 403 && looksLikeVercelSecurityCheckpoint(text)) {
                markCheckpointBlocked();
            }
            throw new Error(`[VPS] ${res.status} ${res.url}${summary ? ` â€” ${summary}` : ''}`);
        }
    },

    /**
     * POST multipart/form-data (upload de arquivo)
     * Usado para upload de banners e imagens.
     */
    upload: async <T>(path: string, formData: FormData): Promise<T> => {
        assertCheckpointNotBlocked(path);
        const headers = await buildHeaders({});
        delete (headers as Record<string, string>)['Content-Type'];
        const res = await fetch(buildVpsUrl(path), {
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
            try {
                assertCheckpointNotBlocked(path);
            } catch (error) {
                reject(error);
                return;
            }
            supabase.auth.getSession().then(({ data }) => {
                const token = data.session?.access_token;
                const syncKey = getVpsSyncKey();
                const xhr = new XMLHttpRequest();
                xhr.open('POST', buildVpsUrl(path));
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                if (syncKey) xhr.setRequestHeader('x-sync-key', syncKey);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), 'sending');
                };
                xhr.upload.onloadend = () => onProgress(100, 'processing');
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(undefined as T); }
                    } else {
                        const summary = summarizeErrorBody(xhr.responseText || '');
                        if (IS_VPS_PROXY_ROUTE && xhr.status === 403 && looksLikeVercelSecurityCheckpoint(xhr.responseText || '')) {
                            markCheckpointBlocked();
                        }
                        reject(new Error(`HTTP ${xhr.status}${summary ? `: ${summary}` : ''}`));
                    }
                };
                xhr.onerror = () => reject(new Error('Erro de rede'));
                xhr.send(formData);
            }).catch(reject);
        });
    },
};
