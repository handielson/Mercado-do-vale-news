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
const VPS_SYNC_KEY = process.env.VITE_VPS_SYNC_KEY || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
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

        // ── Busca o token do Bling para chamar a API quando necessário ────────
        const { data: settings } = await supabase
            .from('company_settings')
            .select('bling_access_token')
            .limit(1)
            .maybeSingle();

        const accessToken: string | null = settings?.bling_access_token || null;

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

            if (!accessToken) {
                // Sem token: usar saldoFisicoTotal do payload como fallback (pode ser impreciso)
                const payloadStock = body?.data?.saldoFisicoTotal ?? body?.dados?.saldoFisicoTotal;
                if (payloadStock === undefined) {
                    return res.status(200).json({ ok: false, message: 'No Bling token and no stock in payload' });
                }
                stockQty = Number(payloadStock);
            } else {
                // Com token: buscar saldo real consolidado de todos os depósitos na API Bling
                stockQty = await fetchBlingStock(blingId!, accessToken);
                if (stockQty === null) {
                    // Fallback para o payload se a API falhar
                    const payloadStock = body?.data?.saldoFisicoTotal ?? body?.dados?.saldoFisicoTotal;
                    stockQty = payloadStock !== undefined ? Number(payloadStock) : null;
                }
                if (stockQty === null) {
                    return res.status(200).json({ ok: false, message: 'Could not fetch stock from Bling' });
                }
            }

            // Resolve SKU via VPS MySQL (produtos estão no MySQL, não no Supabase)
            let resolvedSku = sku;
            if (!resolvedSku && blingId) {
                try {
                    const vpsRes = await fetch(`${VPS_BASE_URL}/products?bling_id=${blingId}&limit=1`);
                    if (vpsRes.ok) {
                        const vpsProducts = await vpsRes.json();
                        resolvedSku = Array.isArray(vpsProducts) && vpsProducts[0]?.sku
                            ? vpsProducts[0].sku
                            : undefined;
                    }
                } catch (_) {
                    // fallback silencioso — o erro será capturado abaixo
                }
            }

            if (!resolvedSku) {
                return res.status(200).json({ ok: false, message: 'SKU não encontrado para bling_id: ' + blingId });
            }

            // Atualiza VPS
            const vpsUpdated = await patchVps('/products/stock', { sku: resolvedSku, stock_quantity: stockQty });

            // Atualiza Supabase
            const supaFilter = blingId
                ? supabase.from('products').update({ stock_quantity: stockQty }).eq('bling_id', blingId)
                : supabase.from('products').update({ stock_quantity: stockQty }).eq('sku', resolvedSku);
            await supaFilter;

            console.log(`[bling-webhook] Stock → SKU=${resolvedSku} qty=${stockQty} VPS=${vpsUpdated}`);
            return res.status(200).json({ ok: true, event, sku: resolvedSku, stock_quantity: stockQty, vpsUpdated });
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
                // Tenta resolver via Supabase
                const { data: product } = await supabase
                    .from('products')
                    .select('sku, name')
                    .eq('bling_id', blingId)
                    .maybeSingle();
                resolvedSku  = product?.sku;
                resolvedName = resolvedName || product?.name;
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
        if (!res.ok) return null;
        const json = await res.json();
        const items: any[] = json.data || [];
        // A API retorna 1 item por depósito para o produto.
        // saldoFisico = saldo deste depósito; saldoFisicoTotal = total consolidado (igual em todos os itens).
        // Usamos saldoFisicoTotal do primeiro item se disponível (já é o total real),
        // caso contrário somamos saldoFisico de cada depósito.
        if (items.length > 0 && items[0].saldoFisicoTotal !== undefined) {
            return items[0].saldoFisicoTotal;
        }
        let total = 0;
        for (const item of items) {
            total += item.saldoFisico ?? 0;
        }
        return total;
    } catch {
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
