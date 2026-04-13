/**
 * vpsClient.ts
 * Cliente HTTP para a API da VPS (https://api.xiaomipetrolina.com.br)
 * Substitui chamadas ao Supabase gradualmente conforme as tabelas migram.
 */

import { supabase } from './supabase';
import { VPS_PROXY_BASE } from './vpsProxyBase';

const CHECKPOINT_COOLDOWN_MS = 60_000;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

let checkpointBlockedUntil = 0;

function getRuntimeProxyBase(): string {
    if (typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname)) {
        return '/vps-proxy';
    }
    return VPS_PROXY_BASE;
}

function buildProxyUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (typeof window !== 'undefined' && LOCAL_HOSTNAMES.has(window.location.hostname) && normalized.startsWith('/synology/')) {
        const localVps = import.meta.env.VITE_LOCAL_VPS_URL || 'http://localhost:4000';
        return `${localVps}${normalized}`;
    }
    return `${getRuntimeProxyBase()}?path=${encodeURIComponent(normalized)}`;
}

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

function getVpsSyncKey(): string {
    // Load from environment variable at runtime
    return import.meta.env.VITE_VPS_SYNC_KEY || '';
}

async function buildHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const syncKey = getVpsSyncKey();
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(syncKey ? { 'x-sync-key': syncKey } : {}),
        ...extra,
    };
    
    if (!syncKey) {
        console.warn('[vpsClient] ⚠️ x-sync-key não configurado. Verifique VITE_VPS_SYNC_KEY');
    }
    
    return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const summary = summarizeErrorBody(text);
        if (res.status === 403 && looksLikeVercelSecurityCheckpoint(text)) {
            markCheckpointBlocked();
        }
        throw new Error(`[VPS] ${res.status} ${res.url}${summary ? ` — ${summary}` : ''}`);
    }
    return res.json() as Promise<T>;
}

function assertCheckpointNotBlocked(path: string): void {
    if (isCheckpointBlockedNow()) {
        const remaining = Math.max(0, Math.ceil((checkpointBlockedUntil - Date.now()) / 1000));
        throw new Error(`[VPS] 403 ${buildProxyUrl(path)} — Vercel Security Checkpoint ativo (aguarde ${remaining}s)`);
    }
}

export const vpsClient = {
    /**
     * GET /resource
     */
    get: async <T>(path: string): Promise<T> => {
        assertCheckpointNotBlocked(path);
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
        assertCheckpointNotBlocked(path);
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
        assertCheckpointNotBlocked(path);
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
        assertCheckpointNotBlocked(path);
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
        assertCheckpointNotBlocked(path);
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
        assertCheckpointNotBlocked(path);
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
            try {
                assertCheckpointNotBlocked(path);
            } catch (error) {
                reject(error);
                return;
            }
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
                        const summary = summarizeErrorBody(xhr.responseText || '');
                        if (xhr.status === 403 && looksLikeVercelSecurityCheckpoint(xhr.responseText || '')) {
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

