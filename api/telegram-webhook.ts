import { createClient } from '@supabase/supabase-js';

const BOT_MANUAL = `🤖 *Manual do Bot — Mercado do Vale*
${'─'.repeat(32)}

📊 *RELATÓRIOS*
/relatorio — Fechamento do dia (vendas, faturamento e lucro)
/vendas — Resumo rápido das vendas de hoje
/top10 — Top 10 produtos mais vendidos

📦 *ESTOQUE*
/estoque — Lista completa de produtos em estoque
/estoque [nome] — Busca produto por nome
Ex: \`/estoque iphone 15\`

💰 *PREÇOS*
/preco [nome] — Consulta preço de um produto
Ex: \`/preco samsung s24\`

🛒 *PEDIDOS*
/pedidos — Pedidos online pendentes

👥 *CLIENTES*
/clientes — Novos clientes desta semana

🔍 *MODELO*
/modelo [nome] — Variações, estoque e preço médio de custo
Ex: \`/modelo iphone 15\`

🏷 *CATEGORIA*
/categoria [nome] — Estoque completo de uma categoria
Ex: \`/categoria celulares\`

🚀 *OUTROS*
/ajuda — Exibe este manual
/ping — Testa se o bot está online

${'─'.repeat(32)}
_Todos os dados são em tempo real do sistema._`;

const fmtMoney = (val: number) =>
    `R$ ${(val / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const fmtMoneyRaw = (val: number) =>
    `R$ ${val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

async function sendTelegram(token: string, chatId: string | number, text: string, parseMode = 'Markdown') {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(200).json({ ok: true });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    // Fetch bot token
    const { data: rows } = await supabase.from('telegram_settings').select('*').limit(1);
    const settings = rows?.[0];

    if (!settings?.active || !settings?.bot_token) {
        return res.status(200).json({ ok: true });
    }

    const token = settings.bot_token;
    const update = req.body;
    const message = update?.message || update?.edited_message;

    if (!message?.text) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text.trim();
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase().replace(/@\w+/g, '');
    const args = parts.slice(1).join(' ');

    const now = new Date();
    const tz = 'America/Sao_Paulo';

    try {
        // ── /ping ────────────────────────────────────────────────────────────
        if (command === '/ping') {
            const time = new Intl.DateTimeFormat('pt-BR', {
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz
            }).format(now);
            await sendTelegram(token, chatId, `✅ Bot online! ⏱ ${time}`);
        }

        // ── /ajuda | /start | /help ──────────────────────────────────────────
        else if (['/ajuda', '/start', '/help', '/menu'].includes(command)) {
            await sendTelegram(token, chatId, BOT_MANUAL);
        }

        // ── /vendas ──────────────────────────────────────────────────────────
        else if (command === '/vendas') {
            const start = new Date(now.toLocaleString('en-US', { timeZone: tz }));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setHours(23, 59, 59, 999);

            const { data: sales } = await supabase
                .from('sales')
                .select('total, profit, created_at')
                .eq('status', 'completed')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .order('created_at', { ascending: false });

            const qty = sales?.length || 0;
            const fat = sales?.reduce((s, r) => s + (r.total || 0), 0) || 0;
            const lucro = sales?.reduce((s, r) => s + (r.profit || 0), 0) || 0;
            const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: tz }).format(now);

            const msg = qty === 0
                ? `📊 *Vendas de hoje (${date})*\n\nNenhuma venda registrada ainda.`
                : `📊 *Vendas de hoje (${date})*\n\n✅ Vendas: *${qty}*\n💰 Faturamento: *${fmtMoneyRaw(fat)}*\n📈 Lucro: *${fmtMoneyRaw(lucro)}*`;

            await sendTelegram(token, chatId, msg);
        }

        // ── /relatorio ───────────────────────────────────────────────────────
        else if (command === '/relatorio') {
            await sendTelegram(token, chatId, '⏳ Gerando relatório completo...');

            const start = new Date(now.toLocaleString('en-US', { timeZone: tz }));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setHours(23, 59, 59, 999);

            const { data: sales } = await supabase
                .from('sales')
                .select('total, profit, payment_method')
                .eq('status', 'completed')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString());

            const qty = sales?.length || 0;
            const fat = sales?.reduce((s, r) => s + (r.total || 0), 0) || 0;
            const lucro = sales?.reduce((s, r) => s + (r.profit || 0), 0) || 0;

            const { data: products } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('status', 'active')
                .gt('stock_quantity', 0);

            const totalEstoque = products?.reduce((s, p) => s + (p.stock_quantity || 0), 0) || 0;

            const { data: pendingOrders } = await supabase
                .from('orders')
                .select('id')
                .eq('status', 'pending');

            const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).format(now);

            let msg = `📊 *Relatório Completo — ${date}*\n${'─'.repeat(28)}\n\n`;
            msg += `🛒 *VENDAS DO DIA*\n`;
            msg += `✅ Quantidade: *${qty} venda(s)*\n`;
            msg += `💰 Faturamento: *${fmtMoneyRaw(fat)}*\n`;
            msg += `📈 Lucro: *${fmtMoneyRaw(lucro)}*\n\n`;
            msg += `📦 *ESTOQUE*\n`;
            msg += `🏪 Total em estoque: *${totalEstoque} unidades*\n\n`;
            if ((pendingOrders?.length || 0) > 0) {
                msg += `⚠️ *ATENÇÃO: ${pendingOrders!.length} pedido(s) online pendente(s)*`;
            }

            await sendTelegram(token, chatId, msg);
        }

        // ── /top10 ───────────────────────────────────────────────────────────
        else if (command === '/top10') {
            await sendTelegram(token, chatId, '⏳ Buscando produtos mais vendidos...');

            const { data: items } = await supabase
                .from('sale_items')
                .select('product_name, quantity')
                .order('created_at', { ascending: false })
                .limit(500);

            if (!items || items.length === 0) {
                await sendTelegram(token, chatId, '📊 Nenhuma venda registrada ainda.');
                return res.status(200).json({ ok: true });
            }

            const map = new Map<string, number>();
            items.forEach(i => {
                const k = i.product_name || 'Sem nome';
                map.set(k, (map.get(k) || 0) + (i.quantity || 1));
            });

            const sorted = Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            let msg = `🏆 *Top 10 Produtos Mais Vendidos*\n${'─'.repeat(28)}\n\n`;
            sorted.forEach(([name, qty], i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                msg += `${medal} *${qty}x* — ${name}\n`;
            });

            await sendTelegram(token, chatId, msg);
        }

        // ── /estoque [busca] ─────────────────────────────────────────────────
        else if (command === '/estoque') {
            let query = supabase
                .from('products')
                .select('name, stock_quantity, specs, price_pix, price_card')
                .eq('status', 'active')
                .gt('stock_quantity', 0)
                .order('name');

            if (args) {
                query = query.ilike('name', `%${args}%`);
            } else {
                query = query.limit(30);
            }

            const { data: products } = await query;

            if (!products || products.length === 0) {
                const msg = args
                    ? `❌ Nenhum produto encontrado com *"${args}"*`
                    : '📦 Nenhum produto em estoque no momento.';
                await sendTelegram(token, chatId, msg);
                return res.status(200).json({ ok: true });
            }

            const title = args
                ? `📦 *Estoque — "${args}"* (${products.length} resultado${products.length > 1 ? 's' : ''})`
                : `📦 *Estoque Geral* (mostrando ${products.length})`;

            let msg = `${title}\n${'─'.repeat(28)}\n\n`;

            products.forEach(p => {
                const color = p.specs?.color || p.specs?.cor || '';
                const ram = p.specs?.ram || '';
                const storage = p.specs?.storage || '';
                const mem = ram && storage ? `${ram}/${storage}` : (ram || storage);
                const variant = [color, mem].filter(Boolean).join(' · ');

                msg += `📱 *${p.name}*\n`;
                if (variant) msg += `   _${variant}_\n`;
                msg += `   📦 Estoque: *${p.stock_quantity} un*`;
                if (p.price_pix) msg += ` · 💰 PIX: *${fmtMoney(p.price_pix)}*`;
                msg += `\n\n`;
            });

            if (!args && products.length === 30) {
                msg += `_Use \`/estoque [nome]\` para buscar um produto específico._`;
            }

            // Truncate if too long
            if (msg.length > 3900) {
                msg = msg.substring(0, 3800) + '\n\n_... lista truncada. Use /estoque [nome] para buscar._';
            }

            await sendTelegram(token, chatId, msg);
        }

        // ── /preco [busca] ───────────────────────────────────────────────────
        else if (command === '/preco') {
            if (!args) {
                await sendTelegram(token, chatId, '❓ Informe o produto. Ex: \`/preco iphone 15 pro\`');
                return res.status(200).json({ ok: true });
            }

            const { data: products } = await supabase
                .from('products')
                .select('name, stock_quantity, specs, price_pix, price_card')
                .eq('status', 'active')
                .ilike('name', `%${args}%`)
                .order('name')
                .limit(5);

            if (!products || products.length === 0) {
                await sendTelegram(token, chatId, `❌ Produto *"${args}"* não encontrado.`);
                return res.status(200).json({ ok: true });
            }

            let msg = `💰 *Preços — "${args}"*\n${'─'.repeat(28)}\n\n`;

            products.forEach(p => {
                const color = p.specs?.color || '';
                const ram = p.specs?.ram || '';
                const storage = p.specs?.storage || '';
                const mem = ram && storage ? `${ram}/${storage}` : (ram || storage);
                const variant = [color, mem].filter(Boolean).join(' · ');

                msg += `📱 *${p.name}*\n`;
                if (variant) msg += `   _${variant}_\n`;
                if (p.price_pix) msg += `   💰 PIX: *${fmtMoney(p.price_pix)}*\n`;
                if (p.price_card) msg += `   💳 Cartão: *${fmtMoney(p.price_card)}*\n`;
                msg += `   📦 Em estoque: *${p.stock_quantity} un*\n\n`;
            });

            await sendTelegram(token, chatId, msg);
        }

        // ── /pedidos ─────────────────────────────────────────────────────────
        else if (command === '/pedidos') {
            const { data: orders } = await supabase
                .from('orders')
                .select('id, customer_name, total, status, created_at, items')
                .in('status', ['pending', 'confirmed'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (!orders || orders.length === 0) {
                await sendTelegram(token, chatId, '✅ Nenhum pedido pendente no momento.');
                return res.status(200).json({ ok: true });
            }

            let msg = `🛒 *Pedidos Pendentes/Confirmados* (${orders.length})\n${'─'.repeat(28)}\n\n`;

            orders.forEach(o => {
                const shortId = o.id?.substring(0, 8).toUpperCase() || '?';
                const statusEmoji = o.status === 'pending' ? '⏳' : '✅';
                const date = new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: tz
                }).format(new Date(o.created_at));

                msg += `${statusEmoji} *#${shortId}* — ${o.customer_name || 'Cliente'}\n`;
                msg += `   💰 ${fmtMoneyRaw(o.total || 0)} · 🕐 ${date}\n\n`;
            });

            await sendTelegram(token, chatId, msg);
        }

        // ── /clientes ────────────────────────────────────────────────────────
        else if (command === '/clientes') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);

            const { data: clients } = await supabase
                .from('customers')
                .select('name, phone, type, created_at')
                .gte('created_at', weekAgo.toISOString())
                .order('created_at', { ascending: false })
                .limit(15);

            if (!clients || clients.length === 0) {
                await sendTelegram(token, chatId, '👥 Nenhum cliente novo nos últimos 7 dias.');
                return res.status(200).json({ ok: true });
            }

            let msg = `👥 *Novos Clientes — Últimos 7 dias* (${clients.length})\n${'─'.repeat(28)}\n\n`;

            clients.forEach(c => {
                const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: tz }).format(new Date(c.created_at));
                const typeLabel = c.type === 'atacado' ? '🏭 Atacado' : '🛍️ Varejo';
                msg += `• *${c.name}* — ${typeLabel} · _${date}_\n`;
                if (c.phone) msg += `  📞 ${c.phone}\n`;
                msg += '\n';
            });

            await sendTelegram(token, chatId, msg);
        }

        // ── /modelo [busca] ──────────────────────────────────────────────────
        else if (command === '/modelo') {
            if (!args) {
                await sendTelegram(token, chatId, '❓ Informe o modelo. Ex: `/modelo iphone 15`');
                return res.status(200).json({ ok: true });
            }

            const { data: products } = await supabase
                .from('products')
                .select('name, stock_quantity, specs, price_cost')
                .eq('status', 'active')
                .gt('stock_quantity', 0)
                .ilike('name', `%${args}%`)
                .order('name');

            if (!products || products.length === 0) {
                await sendTelegram(token, chatId, `❌ Nenhum produto em estoque encontrado para *"${args}"*.`);
                return res.status(200).json({ ok: true });
            }

            // Agrupa por nome do produto (cada nome = uma variação)
            const grouped = new Map<string, { qty: number; costs: number[]; specs: any }>();
            products.forEach(p => {
                const key = p.name;
                if (!grouped.has(key)) {
                    grouped.set(key, { qty: 0, costs: [], specs: p.specs || {} });
                }
                const entry = grouped.get(key)!;
                entry.qty += p.stock_quantity || 0;
                if (p.price_cost && p.price_cost > 0) entry.costs.push(p.price_cost);
            });

            const totalQty = Array.from(grouped.values()).reduce((s, e) => s + e.qty, 0);
            let msg = `🔍 *Modelo — "${args}"* (${grouped.size} variação${grouped.size > 1 ? 'ões' : ''} · ${totalQty} un total)\n${'─'.repeat(28)}\n\n`;

            grouped.forEach((entry, name) => {
                const { qty, costs, specs } = entry;
                const color = specs?.color || specs?.cor || '';
                const ram = specs?.ram || '';
                const storage = specs?.storage || '';
                const mem = ram && storage ? `${ram}/${storage}` : (ram || storage);
                const variant = [color, mem].filter(Boolean).join(' · ');
                const avgCost = costs.length > 0
                    ? costs.reduce((s, c) => s + c, 0) / costs.length
                    : null;

                msg += `📱 *${name}*\n`;
                if (variant) msg += `   _${variant}_\n`;
                msg += `   📦 Estoque: *${qty} un*`;
                if (avgCost) msg += ` · 🏷 Custo médio: *${fmtMoney(avgCost)}*`;
                msg += `\n\n`;
            });

            if (msg.length > 3900) {
                msg = msg.substring(0, 3800) + '\n\n_... lista truncada._';
            }

            await sendTelegram(token, chatId, msg);
        }

        // ── /categoria [busca] ───────────────────────────────────────────────
        else if (command === '/categoria') {
            if (!args) {
                await sendTelegram(token, chatId, '❓ Informe a categoria. Ex: `/categoria celulares`');
                return res.status(200).json({ ok: true });
            }

            // 1. Encontrar categoria pelo nome
            const { data: categories } = await supabase
                .from('categories')
                .select('id, name')
                .ilike('name', `%${args}%`)
                .limit(5);

            if (!categories || categories.length === 0) {
                await sendTelegram(token, chatId, `❌ Categoria *"${args}"* não encontrada.`);
                return res.status(200).json({ ok: true });
            }

            const cat = categories[0];
            await sendTelegram(token, chatId, `⏳ Carregando estoque de *${cat.name}*...`);

            // 2. Buscar todos os produtos em estoque dessa categoria
            const { data: products } = await supabase
                .from('products')
                .select('name, stock_quantity, specs, price_cost, brand')
                .eq('status', 'active')
                .eq('category_id', cat.id)
                .gt('stock_quantity', 0)
                .order('name');

            if (!products || products.length === 0) {
                await sendTelegram(token, chatId, `📦 Nenhum produto em estoque na categoria *${cat.name}*.`);
                return res.status(200).json({ ok: true });
            }

            // 3. Agrupa por nome de produto
            const grouped = new Map<string, { qty: number; costs: number[]; specs: any }>();
            products.forEach(p => {
                const key = p.name;
                if (!grouped.has(key)) {
                    grouped.set(key, { qty: 0, costs: [], specs: p.specs || {} });
                }
                const entry = grouped.get(key)!;
                entry.qty += p.stock_quantity || 0;
                if (p.price_cost && p.price_cost > 0) entry.costs.push(p.price_cost);
            });

            const totalQty = Array.from(grouped.values()).reduce((s, e) => s + e.qty, 0);
            const totalValue = Array.from(grouped.values()).reduce((s, e) => {
                const avg = e.costs.length > 0 ? e.costs.reduce((a, b) => a + b, 0) / e.costs.length : 0;
                return s + avg * e.qty;
            }, 0);

            let msg = `🏷 *Categoria: ${cat.name}*\n`;
            msg += `📦 ${grouped.size} variação${grouped.size > 1 ? 'ões' : ''} · *${totalQty} unidades* em estoque`;
            if (totalValue > 0) msg += ` · 💰 Custo total: *${fmtMoney(totalValue)}*`;
            msg += `\n${'─'.repeat(28)}\n\n`;

            grouped.forEach((entry, name) => {
                const { qty, costs, specs } = entry;
                const color = specs?.color || specs?.cor || '';
                const ram = specs?.ram || '';
                const storage = specs?.storage || '';
                const mem = ram && storage ? `${ram}/${storage}` : (ram || storage);
                const variant = [color, mem].filter(Boolean).join(' · ');
                const avgCost = costs.length > 0
                    ? costs.reduce((s, c) => s + c, 0) / costs.length
                    : null;

                msg += `📱 *${name}*\n`;
                if (variant) msg += `   _${variant}_\n`;
                msg += `   📦 Estoque: *${qty} un*`;
                if (avgCost) msg += ` · 🏷 Custo médio: *${fmtMoney(avgCost)}*`;
                msg += `\n\n`;
            });

            if (msg.length > 3900) {
                msg = msg.substring(0, 3800) + `\n\n_... lista truncada. Use /modelo [nome] para buscar um produto específico._`;
            }

            await sendTelegram(token, chatId, msg);
        }

        // ── Comando desconhecido ─────────────────────────────────────────────
        else if (text.startsWith('/')) {
            await sendTelegram(token, chatId,
                `❓ Comando não reconhecido: *${command}*\n\nDigite /ajuda para ver todos os comandos disponíveis.`
            );
        }

        // ── Texto livre (sem comando) ────────────────────────────────────────
        else {
            await sendTelegram(token, chatId,
                `🤖 Olá! Não entendi a mensagem *"${text}"*.\n\nEste bot funciona apenas com comandos. Digite /ajuda para ver o que posso fazer por você.`
            );
        }

    } catch (err: any) {
        console.error('Telegram webhook error:', err);
        await sendTelegram(token, chatId, '⚠️ Ocorreu um erro ao processar o comando. Tente novamente.');
    }

    return res.status(200).json({ ok: true });
}
