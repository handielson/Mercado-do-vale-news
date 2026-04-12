/**
 * api/bling-webhook.ts
 * Receptor de eventos do Bling v3.
 *
 * Configurar no Bling: Configurações → Integrações → Webhooks
 * URL: https://mercadodovale.com.br/api/bling-webhook
 *
 * Eventos suportados:
 *  - "estoque"  / "movimentacaoEstoque" → atualiza stock_quantity na VPS + Supabase
 *  - "produto"  / "produtos"            → atualiza nome do produto na VPS + Supabase
 */

const VPS_BASE_URL = process.env.VITE_VPS_BASE_URL || 'https://api.xiaomipetrolina.com.br';
const VPS_SYNC_KEY = process.env.VPS_SYNC_KEY || process.env.VITE_VPS_SYNC_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Valida assinatura HMAC-SHA256 do Bling para prevenir webhooks forjados.
// Configura BLING_WEBHOOK_SECRET no painel Bling e nas variáveis de ambiente da Vercel.
function verifyBlingSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.BLING_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validação de assinatura — rejeita callbacks não autenticados pelo Bling
    const signature = req.headers['x-bling-signature'] as string | undefined;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (process.env.BLING_WEBHOOK_SECRET && !verifyBlingSignature(rawBody, signature)) {
        console.warn('[bling-webhook] assinatura inválida — rejeitado');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
        const body = req.body;
        const event: string = (body?.event || body?.evento || '').toLowerCase();

        console.log('[bling-webhook] event:', event, '| payload:', JSON.stringify(body).slice(0, 400));

        if (!event) {
            return res.status(200).json({ ok: true, message: 'No event type — ignored' });
        }

        // ── Supabase client (service role para bypassar RLS) ─────────────────
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // ── Busca token do Bling com refresh automático ───────────────────────
        const { data: settings } = await supabase
            .from('company_settings')
            .select('id, bling_access_token, bling_refresh_token, bling_token_expires_at, bling_client_id, bling_client_secret')
            .limit(1)
            .maybeSingle();

        let accessToken: string | null = settings?.bling_access_token || null;

        // Verifica se o token expirou e tenta renovar via refresh_token
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
                    console.log('[bling-webhook] Token renovado via refresh_token');
                } else {
                    const failBody = await tokenRes.text();
                    console.warn('[bling-webhook] Falha ao renovar token:', failBody);
                    // Não desconecta automaticamente: mantemos o vínculo salvo e
                    // tentamos novamente na próxima execução.
                    accessToken = settings?.bling_access_token || null;
                }
            } catch (refreshErr: any) {
                console.warn('[bling-webhook] Erro no refresh de token:', refreshErr.message);
                accessToken = settings?.bling_access_token || null;
            }
        }

        // ── Evento de ESTOQUE ─────────────────────────────────────────────────
        // Bling v3 (inglês): stock.created, virtual_stock.updated
        // Legado (português): estoque, movimentacaoEstoque
        const isStockEvent = event.includes('stock') || event.includes('estoque') || event.includes('movimentacao');
        if (isStockEvent) {
            const productData = body?.data?.produto || body?.dados?.produto || body?.data;
            const blingId: number | undefined = productData?.id;
            const sku: string | undefined = productData?.codigo;

            if (!blingId && !sku) {
                return res.status(200).json({ ok: true, message: 'No product identifier in stock event' });
            }

            // ATENÇÃO: saldoFisicoTotal no payload = saldo de UM depósito específico,
            // NÃO o saldo total do produto. Sempre buscar da API para obter o total real.
            let stockQty: number | null;
            let stockSource = 'api'; // rastrear origem do valor para logs

            if (!accessToken) {
                // Sem token OAuth: fallback para payload (impreciso — pode ser de 1 depósito)
                const payloadStock = body?.data?.saldoFisicoTotal ?? body?.dados?.saldoFisicoTotal;
                if (payloadStock === undefined) {
                    console.warn('[bling-webhook] Sem token e sem saldoFisicoTotal no payload — abortando atualização de estoque');
                    return res.status(200).json({ ok: false, message: 'No Bling token and no stock in payload' });
                }
                stockQty = Number(payloadStock);
                stockSource = 'payload_no_token';
                console.warn(`[bling-webhook] ⚠️ Sem token OAuth — usando payload saldoFisicoTotal=${stockQty} (pode ser impreciso)`);
            } else {
                // Com token: buscar saldo real consolidado de todos os depósitos na API Bling
                stockQty = await fetchBlingStock(blingId!, accessToken);

                if (stockQty === null) {
                    // API falhou — tenta usar o payload como fallback
                    const payloadStock = body?.data?.saldoFisicoTotal ?? body?.dados?.saldoFisicoTotal;
                    const payloadQty = payloadStock !== undefined ? Number(payloadStock) : null;

                    console.warn(`[bling-webhook] ⚠️ fetchBlingStock falhou para blingId=${blingId} — payloadStock=${payloadQty}`);

                    // ── PROTEÇÃO CONTRA ZERO FALSO ────────────────────────────
                    // Se a API falhou E o payload diz 0, NÃO atualizamos.
                    // Gravar 0 incorreto é pior que manter o valor atual.
                    // O Bling reenviará o evento ou o sync manual corrigirá.
                    if (payloadQty === null || payloadQty === 0) {
                        console.warn(`[bling-webhook] 🛑 ABORTADO: API falhou e payload=${payloadQty} — risco de zerar estoque incorretamente. SKU=${sku} blingId=${blingId}`);
                        return res.status(200).json({
                            ok: false,
                            message: 'API falhou e payload retornou 0 — atualização abortada para evitar estoque zerado incorretamente',
                            blingId,
                            sku,
                        });
                    }

                    // Payload com valor positivo: confiável o suficiente para usar
                    stockQty = payloadQty;
                    stockSource = 'payload_api_fallback';
                    console.warn(`[bling-webhook] ⚠️ Usando payload fallback: saldoFisicoTotal=${stockQty} (API indisponível)`);
                } else {
                    stockSource = 'api';
                }

                if (stockQty === null) {
                    return res.status(200).json({ ok: false, message: 'Could not fetch stock from Bling API' });
                }
            }

            // Resolve SKU do payload (usado para Supabase e logs; VPS aceita bling_id diretamente)
            let resolvedSku = sku;
            if (!resolvedSku && blingId) {
                try {
                    // VPS agora suporta ?bling_id= como filtro (filtro adicionado em BUG-004)
                    const vpsRes = await fetch(`${VPS_BASE_URL}/products?bling_id=${blingId}&limit=1&status=all`);
                    if (vpsRes.ok) {
                        const vpsProducts = await vpsRes.json();
                        resolvedSku = Array.isArray(vpsProducts) && vpsProducts[0]?.sku
                            ? vpsProducts[0].sku
                            : undefined;
                    }
                } catch (_) {
                    // fallback silencioso
                }
            }

            if (!blingId && !resolvedSku) {
                return res.status(200).json({ ok: false, message: 'SKU/bling_id não encontrado no evento de estoque' });
            }

            // Atualiza VPS: prefere bling_id (1 roundtrip, sem lookup de SKU)
            const vpsPayload = blingId
                ? { bling_id: blingId, stock_quantity: stockQty }
                : { sku: resolvedSku, stock_quantity: stockQty };
            const vpsUpdated = await patchVps('/products/stock', vpsPayload);

            // Atualiza Supabase
            const supaFilter = blingId
                ? supabase.from('products').update({ stock_quantity: stockQty }).eq('bling_id', blingId)
                : supabase.from('products').update({ stock_quantity: stockQty }).eq('sku', resolvedSku);
            await supaFilter;

            console.log(`[bling-webhook] Stock → SKU=${resolvedSku ?? '?'} blingId=${blingId} qty=${stockQty} source=${stockSource} VPS=${vpsUpdated}`);
            return res.status(200).json({ ok: true, event, sku: resolvedSku, bling_id: blingId, stock_quantity: stockQty, vpsUpdated });
        }

        // ── Evento de PRODUTO (nome/dados atualizados no Bling) ───────────────
        // Bling v3 (inglês): product.updated, product.created
        // Legado (português): produto, produtos
        const isProductEvent = event.includes('product') || event.includes('produto');
        if (isProductEvent) {
            const productData = body?.data?.produto || body?.dados?.produto || body?.data;
            const blingId: number | undefined = productData?.id;
            const nome: string | undefined = productData?.nome || productData?.name;
            const codigo: string | undefined = productData?.codigo;

            if (!blingId && !codigo) {
                return res.status(200).json({ ok: true, message: 'No product identifier in product event' });
            }

            // Se vier o nome direto no payload, usa; caso contrário, busca na API
            let resolvedName = nome;
            let resolvedSku = codigo;

            if ((!resolvedName || !resolvedSku) && accessToken && blingId) {
                const detail = await fetchBlingProductDetail(blingId, accessToken);
                if (detail) {
                    resolvedName = resolvedName || detail.nome;
                    resolvedSku  = resolvedSku  || detail.codigo;
                }
            }

            if (!resolvedSku) {
                // Resolve SKU via VPS MySQL (produtos estão no MySQL, não no Supabase)
                try {
                    const vpsRes = await fetch(`${VPS_BASE_URL}/products?bling_id=${blingId}&limit=1`);
                    if (vpsRes.ok) {
                        const vpsProducts = await vpsRes.json();
                        if (Array.isArray(vpsProducts) && vpsProducts[0]) {
                            resolvedSku  = resolvedSku  || vpsProducts[0].sku;
                            resolvedName = resolvedName || vpsProducts[0].name;
                        }
                    }
                } catch (_) {
                    // fallback silencioso
                }
            }

            if (!resolvedSku) {
                return res.status(200).json({ ok: false, message: 'SKU não encontrado para bling_id: ' + blingId });
            }

            const updates: Record<string, any> = {};
            if (resolvedName) updates.name = resolvedName;

            if (Object.keys(updates).length === 0) {
                return res.status(200).json({ ok: true, message: 'Nothing to update' });
            }

            // Atualiza VPS
            const vpsUpdated = await patchVps('/products/name', { sku: resolvedSku, ...updates });

            // Atualiza Supabase
            await supabase
                .from('products')
                .update(updates)
                .eq('bling_id', blingId);

            console.log(`[bling-webhook] Product name → SKU=${resolvedSku} name="${resolvedName}" VPS=${vpsUpdated}`);
            return res.status(200).json({ ok: true, event, sku: resolvedSku, updates, vpsUpdated });
        }

        // Evento não tratado — responde 200 para o Bling não retentar
        return res.status(200).json({ ok: true, message: `Event '${event}' not handled` });

    } catch (err: any) {
        console.error('[bling-webhook] Fatal error:', err.message);
        // Sempre 200 para evitar retries infinitos do Bling
        return res.status(200).json({ ok: false, error: err.message });
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** PATCH um endpoint da VPS com autenticação */
async function patchVps(path: string, body: object): Promise<boolean> {
    if (!VPS_SYNC_KEY) return false;
    try {
        const res = await fetch(`${VPS_BASE_URL}${path}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Sync-Key': VPS_SYNC_KEY,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/** Busca saldo de estoque na API v3 do Bling */
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
            console.warn(`[bling-webhook] fetchBlingStock HTTP ${res.status} para blingId=${blingId} — token inválido/expirado?`);
            return null;
        }
        const json = await res.json();
        const items: any[] = json.data || [];
        // A API retorna 1 item por depósito para o produto.
        // saldoFisico = saldo deste depósito; saldoFisicoTotal = total consolidado (igual em todos os itens).
        // Usamos saldoFisicoTotal do primeiro item se disponível (já é o total real),
        // caso contrário somamos saldoFisico de cada depósito.
        if (items.length > 0 && items[0].saldoFisicoTotal !== undefined) {
            const total = items[0].saldoFisicoTotal;
            console.log(`[bling-webhook] fetchBlingStock OK: blingId=${blingId} saldoFisicoTotal=${total} (${items.length} depósito(s))`);
            return total;
        }
        let total = 0;
        for (const item of items) {
            total += item.saldoFisico ?? 0;
        }
        console.log(`[bling-webhook] fetchBlingStock OK (soma depósitos): blingId=${blingId} total=${total}`);
        return total;
    } catch (err: any) {
        console.warn(`[bling-webhook] fetchBlingStock exception: ${err.message}`);
        return null;
    }
}

/** Busca dados de um produto na API v3 do Bling */
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
