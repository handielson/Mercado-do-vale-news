/**
 * vpsClient.ts
 * Cliente HTTP para a API da VPS (https://api.xiaomipetrolina.com.br)
 * Substitui chamadas ao VPS gradualmente conforme as tabelas migram.
 */

import { getAuthSessionToken } from './authSession';
import {
    buildVpsUrl,
    getVpsSyncHeaders,
    getVpsSyncKey,
    isVpsProxyPath,
} from './vpsProxyBase';

const CHECKPOINT_COOLDOWN_MS = 60_000;
const PUBLIC_STOREFRONT_READ_TIMEOUT_MS = 3500;

let checkpointBlockedUntil = 0;
let hasWarnedMissingSyncKey = false;

function isPublicStorefrontRuntime(): boolean {
    if (typeof window === 'undefined') return false;
    return !/^\/(?:admin|pdv|auth|login)(?:\/|$)/.test(window.location.pathname);
}

function isPublicReadPath(path: string): boolean {
    return (
        path.startsWith('/banners') ||
        path.startsWith('/battery-healths') ||
        path.startsWith('/brands') ||
        path.startsWith('/catalog-settings') ||
        path.startsWith('/catalog/metadata') ||
        path.startsWith('/categories') ||
        path.startsWith('/payment-fees') ||
        path.startsWith('/products') ||
        path.startsWith('/public/') ||
        path.startsWith('/shipping/') ||
        path.startsWith('/status')
    );
}

function getPublicStorefrontSignal(path: string): AbortSignal | undefined {
    if (!isPublicStorefrontRuntime() || !isPublicReadPath(path)) return undefined;
    if (typeof AbortSignal === 'undefined' || !('timeout' in AbortSignal)) return undefined;
    return AbortSignal.timeout(PUBLIC_STOREFRONT_READ_TIMEOUT_MS);
}

function isCheckpointBlockedNow(): boolean {
    return Date.now() < checkpointBlockedUntil;
}

function markCheckpointBlocked(): void {
    checkpointBlockedUntil = Date.now() + CHECKPOINT_COOLDOWN_MS;
}

function looksLikeLegacySecurityCheckpoint(text: string): boolean {
    const lower = (text || '').toLowerCase();
    return lower.includes('security checkpoint') || lower.includes("we're verifying your browser");
}

function summarizeErrorBody(text: string): string {
    const trimmed = (text || '').trim();
    if (!trimmed) return '';
    if (looksLikeLegacySecurityCheckpoint(trimmed)) {
        return 'checkpoint de seguranca legado (bloqueio anti-bot temporario)';
    }
    if (trimmed.length > 240) return `${trimmed.slice(0, 240)}...`;
    return trimmed;
}

async function buildHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
    const token = await getAuthSessionToken();
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
        console.warn('[vpsClient] x-sync-key nao configurado. Verifique VITE_VPS_SYNC_KEY');
    }

    return headers;
}

async function handleResponse<T>(path: string, method: string, res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const summary = summarizeErrorBody(text);
        if (isVpsProxyPath(path, method) && res.status === 403 && looksLikeLegacySecurityCheckpoint(text)) {
            markCheckpointBlocked();
        }
        throw new Error(`[VPS] ${res.status} ${res.url}${summary ? ` — ${summary}` : ''}`);
    }
    return res.json() as Promise<T>;
}

function assertCheckpointNotBlocked(path: string, method: string = 'GET'): void {
    if (!isVpsProxyPath(path, method)) return;
    if (isCheckpointBlockedNow()) {
        const remaining = Math.max(0, Math.ceil((checkpointBlockedUntil - Date.now()) / 1000));
        throw new Error(`[VPS] 403 ${buildVpsUrl(path, { method })} — checkpoint de seguranca legado ativo (aguarde ${remaining}s)`);
    }
}

export const vpsClient = {
    /**
     * GET /resource
     */
    get: async <T>(path: string): Promise<T> => {
        assertCheckpointNotBlocked(path, 'GET');
        const res = await fetch(buildVpsUrl(path, { method: 'GET' }), {
            headers: await buildHeaders(),
            cache: 'no-store',
            signal: getPublicStorefrontSignal(path),
        });
        return handleResponse<T>(path, 'GET', res);
    },

    /**
     * POST /resource  (body JSON)
     */
    post: async <T>(path: string, body: unknown): Promise<T> => {
        assertCheckpointNotBlocked(path, 'POST');
        const res = await fetch(buildVpsUrl(path, { method: 'POST' }), {
            method: 'POST',
            headers: await buildHeaders(),
            body: JSON.stringify(body),
            signal: getPublicStorefrontSignal(path),
        });
        return handleResponse<T>(path, 'POST', res);
    },

    /**
     * PATCH /resource/:id  (body JSON)
     */
    patch: async <T>(path: string, body: unknown): Promise<T> => {
        assertCheckpointNotBlocked(path, 'PATCH');
        const res = await fetch(buildVpsUrl(path, { method: 'PATCH' }), {
            method: 'PATCH',
            headers: await buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(path, 'PATCH', res);
    },

    /**
     * PUT /resource/:id  (body JSON)
     */
    put: async <T>(path: string, body: unknown): Promise<T> => {
        assertCheckpointNotBlocked(path, 'PUT');
        const res = await fetch(buildVpsUrl(path, { method: 'PUT' }), {
            method: 'PUT',
            headers: await buildHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<T>(path, 'PUT', res);
    },

    /**
     * DELETE /resource/:id
     */
    delete: async <T = void>(path: string): Promise<T> => {
        assertCheckpointNotBlocked(path, 'DELETE');
        const headers = await buildHeaders();
        delete (headers as Record<string, string>)['Content-Type'];
        const res = await fetch(buildVpsUrl(path, { method: 'DELETE' }), {
            method: 'DELETE',
            headers,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            const summary = summarizeErrorBody(text);
            if (isVpsProxyPath(path, 'DELETE') && res.status === 403 && looksLikeLegacySecurityCheckpoint(text)) {
                markCheckpointBlocked();
            }
            throw new Error(`[VPS] ${res.status} ${res.url}${summary ? ` — ${summary}` : ''}`);
        }
        const text = await res.text().catch(() => '');
        return (text ? JSON.parse(text) : undefined) as T;
    },

    /**
     * POST multipart/form-data (upload de arquivo)
     * Usado para upload de banners e imagens.
     */
    upload: async <T>(path: string, formData: FormData): Promise<T> => {
        assertCheckpointNotBlocked(path, 'POST');
        const headers = await buildHeaders({});
        delete (headers as Record<string, string>)['Content-Type'];
        const res = await fetch(buildVpsUrl(path, { method: 'POST' }), {
            method: 'POST',
            headers,
            body: formData,
        });
        return handleResponse<T>(path, 'POST', res);
    },

    /**
     * POST multipart/form-data com rastreamento de progresso via XHR.
     * onProgress: (pct: 0-100, phase: 'sending'|'processing') => void
     */
    uploadWithProgress: <T>(
        path: string,
        formData: FormData,
        onProgress: (pct: number, phase: 'sending' | 'processing') => void
    ): Promise<T> => {
        return new Promise((resolve, reject) => {
            try {
                assertCheckpointNotBlocked(path, 'POST');
            } catch (error) {
                reject(error);
                return;
            }

            getAuthSessionToken().then((token) => {
                const syncKey = getVpsSyncKey();
                const xhr = new XMLHttpRequest();
                xhr.open('POST', buildVpsUrl(path, { method: 'POST' }));
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                if (syncKey) xhr.setRequestHeader('x-sync-key', syncKey);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100), 'sending');
                };
                xhr.upload.onloadend = () => onProgress(100, 'processing');
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch {
                            resolve(undefined as T);
                        }
                    } else {
                        const summary = summarizeErrorBody(xhr.responseText || '');
                        if (isVpsProxyPath(path, 'POST') && xhr.status === 403 && looksLikeLegacySecurityCheckpoint(xhr.responseText || '')) {
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
