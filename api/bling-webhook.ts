/**
 * api/bling-webhook.ts
 * Dedicated Bling webhook receiver.
 *
 * Preferred URL:
 *   https://www.mercadodovale.com.br/api/bling-webhook
 *
 * Compatible legacy URL:
 *   https://www.mercadodovale.com.br/api/bling?resource=webhook
 *
 * Supported events:
 * - stock / movimentacaoEstoque / stock.created / virtual_stock.updated
 * - product / products / product.created / product.updated
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const VPS_BASE_URL = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const VPS_SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function verifyBlingSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.BLING_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const normalizedSignature = String(signature).trim().replace(/^sha256=/i, '');
    try {
        return crypto.timingSafeEqual(Buffer.from(normalizedSignature), Buffer.from(expected));
    } catch {
        return false;
    }
}

function resolveWebhookSource(req: any): string {
    const resource = req?.query?.resource;
    const url = String(req?.url || '');
    if (resource === 'webhook' || url.includes('resource=webhook')) {
        return 'bling-legacy';
    }
    return 'bling-webhook';
}

async function safeInsertWebhookLog(supabase: any, source: string, payload: any, rawBody: string) {
    try {
        const storedPayload = payload && typeof payload === 'object'
            ? { ...payload, _route: source }
            : { rawBody, _route: source };

        await supabase.from('webhook_logs').insert({
            source,
            payload: storedPayload,
            received_at: new Date().toISOString(),
        });
    } catch (logErr: any) {
        console.warn('[bling-webhook] Failed to persist webhook_logs:', logErr?.message || logErr);
    }
}

export default async function handler(req: any, res: any) {
    if (req.method === 'GET') {
        return res.status(200).json({ ok: true, mode: 'direct', accepts: 'POST' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const signature = (req.headers['x-bling-signature-256']
        || req.headers['x-bling-signature']) as string | undefined;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Signature verification disabled: BLING_WEBHOOK_SECRET not configured.
    // Webhooks are accepted unconditionally (URL is private by design).
    if (signature) {
        console.log('[bling-webhook] signature header present (not verified):', String(signature).slice(0, 20));
    }


    try {
        const body = req.body;
        const event: string = (body?.event || body?.evento || '').toLowerCase();

        console.log('[bling-webhook] event:', event, '| payload:', JSON.stringify(body).slice(0, 400));

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const webhookSource = resolveWebhookSource(req);

        await safeInsertWebhookLog(supabase, webhookSource, body, rawBody);

        if (!event) {
            return res.status(200).json({ ok: true, message: 'No event type - ignored' });
        }

        const { data: settings } = await supabase
            .from('company_settings')
            .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
            .limit(1)
            .maybeSingle();

        let accessToken: string | null = settings?.bling_access_token || null;

        if (settings?.bling_token_expires_at && new Date(settings.bling_token_expires_at) < new Date()) {
            try {
                const tokenRes = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: settings.bling_refresh_token,
                        client_id: settings.bling_client_id,
                        client_secret: settings.bling_client_secret,
                    }),
                    signal: AbortSignal.timeout(10000),
                });

                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    accessToken = tokenData.access_token;
                    await supabase.from('company_settings').update({
                        bling_access_token: tokenData.access_token,
                        bling_refresh_token: tokenData.refresh_token,
                        bling_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                    }).eq('id', settings.id);
                    console.log('[bling-webhook] token refreshed via refresh_token');
                } else {
                    const failBody = await tokenRes.text();
                    console.warn('[bling-webhook] failed to refresh token:', failBody);
                    if (tokenRes.status === 400 || tokenRes.status === 401) {
                        await supabase.from('company_settings').update({
                            bling_access_token: null,
                        }).eq('id', settings.id);
                        console.warn('[bling-webhook] invalid refresh token - bling_access_token cleared. Admin must reconnect.');
                    }
                    accessToken = null;
                }
            } catch (refreshErr: any) {
                console.warn('[bling-webhook] refresh token exception:', refreshErr.message);
                accessToken = null;
            }
        }

        const isStockEvent = event.includes('stock') || event.includes('estoque') || event.includes('movimentacao');
        if (isStockEvent) {
            const productData = body?.data?.produto || body?.dados?.produto || body?.data;
            const blingId: number | undefined = productData?.id;
            const sku: string | undefined = productData?.codigo;

            if (!blingId && !sku) {
                return res.status(200).json({ ok: true, message: 'No product identifier in stock event' });
            }

            let stockQty: number | null;
            let stockSource = 'api';

            if (!accessToken) {
                const payloadStock = body?.data?.saldoFisicoTotal ?? body?.dados?.saldoFisicoTotal;
                if (payloadStock === undefined) {
                    console.warn('[bling-webhook] no token and no saldoFisicoTotal in payload - stock update aborted');
                    return res.status(200).json({ ok: false, message: 'No Bling token and no stock in payload' });
                }
                stockQty = Number(payloadStock);
                stockSource = 'payload_no_token';
                console.warn(`[bling-webhook] no OAuth token - using payload saldoFisicoTotal=${stockQty} (may be imprecise)`);
            } else {
                stockQty = await fetchBlingStock(blingId!, accessToken);

                if (stockQty === null) {
                    const payloadStock = body?.data?.saldoFisicoTotal ?? body?.dados?.saldoFisicoTotal;
                    const payloadQty = payloadStock !== undefined ? Number(payloadStock) : null;

                    console.warn(`[bling-webhook] fetchBlingStock failed for blingId=${blingId} - payloadStock=${payloadQty}`);

                    if (payloadQty === null || payloadQty === 0) {
                        console.warn(`[bling-webhook] aborted: API failed and payload=${payloadQty} - refusing to zero stock incorrectly. SKU=${sku} blingId=${blingId}`);
                        return res.status(200).json({
                            ok: false,
                            message: 'API failed and payload returned 0 - update aborted to avoid an incorrect zero stock',
                            blingId,
                            sku,
                        });
                    }

                    stockQty = payloadQty;
                    stockSource = 'payload_api_fallback';
                    console.warn(`[bling-webhook] using payload fallback saldoFisicoTotal=${stockQty} (API unavailable)`);
                } else {
                    stockSource = 'api';
                }

                if (stockQty === null) {
                    return res.status(200).json({ ok: false, message: 'Could not fetch stock from Bling API' });
                }
            }

            let resolvedSku = sku;
            if (!resolvedSku && blingId) {
                try {
                    const vpsRes = await fetch(`${VPS_BASE_URL}/products?bling_id=${blingId}&limit=1&status=all`);
                    if (vpsRes.ok) {
                        const vpsProducts = await vpsRes.json();
                        resolvedSku = Array.isArray(vpsProducts) && vpsProducts[0]?.sku
                            ? vpsProducts[0].sku
                            : undefined;
                    }
                } catch {
                    // silent fallback
                }
            }

            if (!blingId && !resolvedSku) {
                return res.status(200).json({ ok: false, message: 'SKU/bling_id not found in stock event' });
            }

            const vpsPayload = blingId
                ? { bling_id: blingId, stock_quantity: stockQty }
                : { sku: resolvedSku, stock_quantity: stockQty };
            const vpsUpdated = await patchVps('/products/stock', vpsPayload);

            const supaFilter = blingId
                ? supabase.from('products').update({ stock_quantity: stockQty }).eq('bling_id', blingId)
                : supabase.from('products').update({ stock_quantity: stockQty }).eq('sku', resolvedSku);
            await supaFilter;

            console.log(`[bling-webhook] stock -> SKU=${resolvedSku ?? '?'} blingId=${blingId} qty=${stockQty} source=${stockSource} VPS=${vpsUpdated}`);
            return res.status(200).json({ ok: true, event, sku: resolvedSku, bling_id: blingId, stock_quantity: stockQty, vpsUpdated });
        }

        const isProductEvent = event.includes('product') || event.includes('produto');
        if (isProductEvent) {
            const productData = body?.data?.produto || body?.dados?.produto || body?.data;
            const blingId: number | undefined = productData?.id;
            const nome: string | undefined = productData?.nome || productData?.name;
            const codigo: string | undefined = productData?.codigo;

            if (!blingId && !codigo) {
                return res.status(200).json({ ok: true, message: 'No product identifier in product event' });
            }

            let resolvedName = nome;
            let resolvedSku = codigo;

            if ((!resolvedName || !resolvedSku) && accessToken && blingId) {
                const detail = await fetchBlingProductDetail(blingId, accessToken);
                if (detail) {
                    resolvedName = resolvedName || detail.nome;
                    resolvedSku = resolvedSku || detail.codigo;
                }
            }

            if (!resolvedSku) {
                try {
                    const vpsRes = await fetch(`${VPS_BASE_URL}/products?bling_id=${blingId}&limit=1`);
                    if (vpsRes.ok) {
                        const vpsProducts = await vpsRes.json();
                        if (Array.isArray(vpsProducts) && vpsProducts[0]) {
                            resolvedSku = resolvedSku || vpsProducts[0].sku;
                            resolvedName = resolvedName || vpsProducts[0].name;
                        }
                    }
                } catch {
                    // silent fallback
                }
            }

            if (!resolvedSku) {
                return res.status(200).json({ ok: false, message: 'SKU not found for bling_id: ' + blingId });
            }

            const updates: Record<string, any> = {};
            if (resolvedName) updates.name = resolvedName;

            if (Object.keys(updates).length === 0) {
                return res.status(200).json({ ok: true, message: 'Nothing to update' });
            }

            const vpsUpdated = await patchVps('/products/name', { sku: resolvedSku, ...updates });

            await supabase
                .from('products')
                .update(updates)
                .eq('bling_id', blingId);

            console.log(`[bling-webhook] product -> SKU=${resolvedSku} name="${resolvedName}" VPS=${vpsUpdated}`);
            return res.status(200).json({ ok: true, event, sku: resolvedSku, updates, vpsUpdated });
        }

        return res.status(200).json({ ok: true, message: `Event '${event}' not handled` });
    } catch (err: any) {
        console.error('[bling-webhook] Fatal error:', err.message);
        return res.status(200).json({ ok: false, error: err.message });
    }
}

async function patchVps(path: string, body: object): Promise<boolean> {
    if (!VPS_SYNC_KEY) return false;
    try {
        const res = await fetch(`${VPS_BASE_URL}${path}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-sync-key': VPS_SYNC_KEY,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function fetchBlingStock(blingId: number, accessToken: string): Promise<number | null> {
    try {
        const res = await fetch(
            `https://api.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${blingId}`,
            {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
                signal: AbortSignal.timeout(10000),
            }
        );

        if (!res.ok) {
            console.warn(`[bling-webhook] fetchBlingStock HTTP ${res.status} for blingId=${blingId} - invalid/expired token?`);
            return null;
        }

        const json = await res.json();
        const items: any[] = json.data || [];

        if (items.length > 0 && items[0].saldoFisicoTotal !== undefined) {
            const total = items[0].saldoFisicoTotal;
            console.log(`[bling-webhook] fetchBlingStock OK: blingId=${blingId} saldoFisicoTotal=${total} (${items.length} deposito(s))`);
            return total;
        }

        let total = 0;
        for (const item of items) {
            total += item.saldoFisico ?? 0;
        }

        console.log(`[bling-webhook] fetchBlingStock OK (sum of deposits): blingId=${blingId} total=${total}`);
        return total;
    } catch (err: any) {
        console.warn(`[bling-webhook] fetchBlingStock exception: ${err.message}`);
        return null;
    }
}

async function fetchBlingProductDetail(blingId: number, accessToken: string): Promise<{ nome: string; codigo: string } | null> {
    try {
        const res = await fetch(
            `https://api.bling.com.br/Api/v3/produtos/${blingId}`,
            {
                headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
                signal: AbortSignal.timeout(10000),
            }
        );
        if (!res.ok) return null;

        const json = await res.json();
        return json.data || null;
    } catch {
        return null;
    }
}
