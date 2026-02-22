import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function (Execution limit: 10s-60s)
export default async function handler(req: any, res: any) {
    // Ignora chamadas que não venham do CRON ou de ADMIN se necessário, mas na Vercel as crons são protegidas nativamente (via header authorization se configurado). 
    // Para fins de teste/dispatch simples, permitimos GET/POST.

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase credentials missing from environment' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });

    try {
        // 1. Fetch Telegram settings
        const { data: rows, error } = await supabase
            .from('telegram_settings')
            .select('*')
            .limit(1);

        const settings = rows?.[0];

        if (error || !settings || !settings.active || !settings.bot_token || !settings.chat_id) {
            return res.status(200).json({
                message: 'Telegram integration inactive or not fully configured',
                debug: {
                    error: error?.message || null,
                    errorDetails: error,
                    hasSettings: !!settings,
                    isActive: settings?.active || false,
                    hasToken: !!settings?.bot_token,
                    hasChatId: !!settings?.chat_id
                }
            });
        }

        if (!settings.templates || !Array.isArray(settings.templates)) {
            return res.status(200).json({ message: 'No templates configured' });
        }

        // 2. Discover the current hour in Brazil timezone
        const now = new Date();
        const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });

        const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
        });

        // Convert current time to "HH:00" mapping (crons are executed hourly)
        const parts = timeFormatter.formatToParts(now);
        const hour = parts.find(p => p.type === 'hour')?.value || '00';
        // Se a cron rodou, ela quer processar quem agendou pra "19:00" às 19:xx
        const currentHourPrefix = `${hour}:`;

        const forceTemplateId = req.query?.forceTemplateId;

        // 3. Find templates scheduled for this specific hour (or forced)
        const scheduledTemplates = settings.templates.filter((t: any) => {
            if (forceTemplateId) {
                return t.id === forceTemplateId;
            }
            return t.type === 'scheduled' && t.schedule_time && t.schedule_time.startsWith(currentHourPrefix);
        });

        if (scheduledTemplates.length === 0) {
            return res.status(200).json({ message: forceTemplateId ? 'Template não encontrado.' : `No templates scheduled for hour ${hour}` });
        }

        // 4. Gather Data for Context Variables

        // 4.0 Dados da Empresa
        let companyData: Record<string, string> = {};
        try {
            const { data: companyRow } = await supabase
                .from('company_settings')
                .select('name, phone, email, social_instagram, business_hours, address_street, address_city, address_state, address_number, address_neighborhood')
                .limit(1)
                .single();

            if (companyRow) {
                const addr = [
                    companyRow.address_street,
                    companyRow.address_number,
                    companyRow.address_neighborhood,
                    companyRow.address_city,
                    companyRow.address_state
                ].filter(Boolean).join(', ');

                companyData = {
                    '{empresa_nome}': companyRow.name || '',
                    '{empresa_telefone}': companyRow.phone || '',
                    '{empresa_whatsapp}': companyRow.phone || '',
                    '{empresa_email}': companyRow.email || '',
                    '{empresa_instagram}': companyRow.social_instagram ? `@${companyRow.social_instagram.replace(/^@/, '')}` : '',
                    '{empresa_horario}': companyRow.business_hours || '',
                    '{empresa_endereco}': addr,
                };
            }
        } catch { /* sem dados da empresa — continua sem as tags */ }

        // 4.1 Faturamento do Dia

        const startOfDay = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('total, profit')
            .eq('status', 'completed')
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());

        let qtd_vendas = 0;
        let faturamento = 0;
        let lucro_total = 0;

        if (!salesError && sales) {
            qtd_vendas = sales.length;
            faturamento = sales.reduce((sum, s) => sum + (s.total || 0), 0);
            lucro_total = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
        }

        const { data: dateResult } = await supabase.rpc('now');

        const fmtMoney = (val: number) => `R$ ${val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

        // 4.2 Estoque Global
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('name, stock_quantity, specs, category_id, model_id, price_cost')
            .eq('status', 'active')
            .gt('stock_quantity', 0);

        let estoqueCelularesTotal = 0;
        let estoqueGeralTotal = 0;
        let celularListStr = '';

        if (!productsError && products) {
            // Map: groupingKey -> { qtd: number, costTotal: number }
            const celularesMap = new Map<string, { qtd: number; costTotal: number }>();

            products.forEach(p => {
                const qtd = p.stock_quantity || 0;
                estoqueGeralTotal += qtd;

                const nameLower = p.name.toLowerCase();
                const isCelular = nameLower.includes('iphone') || nameLower.includes('samsung') || nameLower.includes('xiaomi') || nameLower.includes('motorola') || nameLower.includes('smartphone') || nameLower.includes('galaxy') || nameLower.includes('poco') || nameLower.includes('redmi') || nameLower.includes('realme');

                if (isCelular) {
                    estoqueCelularesTotal += qtd;
                    const color = p.specs?.color || p.specs?.cor || '';
                    const ram = p.specs?.ram || '';
                    const storage = p.specs?.storage || '';
                    const memory = ram && storage ? `${ram}/${storage}` : (ram || storage);
                    const variant = [color, memory].filter(Boolean).join(' - ');
                    const groupingKey = variant ? `${p.name} - ${variant}` : p.name;

                    const existing = celularesMap.get(groupingKey) || { qtd: 0, costTotal: 0 };
                    celularesMap.set(groupingKey, {
                        qtd: existing.qtd + qtd,
                        costTotal: existing.costTotal + ((p.price_cost || 0) * qtd),
                    });
                }
            });

            const sortedList = Array.from(celularesMap.entries())
                .sort((a, b) => b[1].qtd - a[1].qtd)
                .map(([itemName, data]) => {
                    const avgCost = data.qtd > 0 ? data.costTotal / data.qtd : 0;
                    const costStr = avgCost > 0 ? ` (${fmtMoney(avgCost / 100)})` : '';

                    return `• ${data.qtd}x - ${itemName}${costStr}`;
                });

            celularListStr = sortedList.length > 0 ? sortedList.join('\n') : 'Nenhum celular em estoque.';
        }

        // 5. Preparar o Dicionário de Variáveis Built-in
        const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const CONTENT_EMOJI: Record<string, string> = { story: '📸', reels: '🎬', carrossel: '🎴', post: '📷' };
        const CONTENT_LABEL: Record<string, string> = { story: 'Story', reels: 'Reels', carrossel: 'Carrossel', post: 'Post Feed' };

        // Resolver {agenda_instagram_semana}
        let agendaSemanaTxt = '';
        try {
            const nlDb = (s: string | null) => (s || '').replace(/\\n/g, '\n');
            // Escapa chars que quebram Markdown v1 nos campos dinâmicos
            const safe = (s: string | null) => nlDb(s).replace(/[*_`[\]]/g, (c) => c === '_' ? ' ' : '');

            const { data: allSlots, error: slotsErr } = await supabase
                .from('instagram_schedule')
                .select('*')
                .eq('active', true)
                .order('day_of_week')
                .order('scheduled_time');

            if (slotsErr) console.error('instagram_schedule RLS/error:', slotsErr.message);

            if (allSlots && allSlots.length > 0) {
                agendaSemanaTxt = `📅 PROGRAMAÇÃO INSTAGRAM DA SEMANA\n${'═'.repeat(28)}\n\n`;

                const byDay = new Map<number, typeof allSlots>();
                for (const slot of allSlots) {
                    if (!byDay.has(slot.day_of_week)) byDay.set(slot.day_of_week, []);
                    byDay.get(slot.day_of_week)!.push(slot);
                }

                for (const [day, slots] of Array.from(byDay.entries()).sort((a, b) => a[0] - b[0])) {
                    agendaSemanaTxt += `📆 ${DAY_NAMES[day]}\n${'─'.repeat(22)}\n`;
                    for (const slot of slots) {
                        const time = slot.scheduled_time?.slice(0, 5) || '??:??';
                        const emoji = CONTENT_EMOJI[slot.content_type] || '📱';
                        const label = CONTENT_LABEL[slot.content_type] || slot.content_type;
                        agendaSemanaTxt += `\n${emoji} ${time} — ${label}\n`;
                        if (slot.hook) agendaSemanaTxt += `🎣 ${safe(slot.hook)}\n`;
                        if (slot.caption) agendaSemanaTxt += `📝 ${safe(slot.caption)}\n`;
                        if (slot.cta) agendaSemanaTxt += `👉 ${safe(slot.cta)}\n`;
                        if (slot.hashtags) agendaSemanaTxt += `🏷 ${safe(slot.hashtags)}\n`;
                        if (slot.visual_notes) agendaSemanaTxt += `🎨 ${safe(slot.visual_notes)}\n`;
                    }
                    agendaSemanaTxt += '\n';
                }

                // Garantir que não ultrapassa 3800 chars (limite Telegram = 4096)
                if (agendaSemanaTxt.length > 3800) {
                    agendaSemanaTxt = agendaSemanaTxt.substring(0, 3700) + `\n\n... [+${allSlots.length} posts. Ver agenda completa no admin]`;
                } else {
                    agendaSemanaTxt += `✅ Total: ${allSlots.length} posts planejados para a semana.`;
                }
            } else {
                agendaSemanaTxt = 'Nenhum slot de Instagram cadastrado para a semana.';
            }
        } catch {
            agendaSemanaTxt = 'Erro ao carregar agenda Instagram.';
        }

        const builtinDict: Record<string, string> = {
            '{qtd_vendas}': qtd_vendas.toString(),
            '{faturamento}': fmtMoney(faturamento),
            '{lucro_total}': fmtMoney(lucro_total),
            '{data}': dateFormatter.format(now),
            '{estoque_celulares}': estoqueCelularesTotal.toString(),
            '{estoque_geral_loja}': estoqueGeralTotal.toString(),
            '{estoque_lista_celulares}': celularListStr,
            '{agenda_instagram_semana}': agendaSemanaTxt,
        };


        // 5.1 Carregar tags customizadas do banco e resolvê-las
        let customDict: Record<string, string> = {};
        try {
            const { data: systemTags } = await supabase
                .from('system_tags')
                .select('*')
                .eq('active', true)
                .neq('resolver_type', 'system_injected');

            if (systemTags && systemTags.length > 0) {
                for (const tag of systemTags) {
                    try {
                        const value = await resolveTagInline(tag, supabase, now, fmtMoney);
                        customDict[`{${tag.name}}`] = value;
                    } catch { /* ignora falha individual */ }
                }
            }
        } catch { /* ignora falha na busca — usa só o built-in */ }

        // Custom tags sobrescrevem built-in se nomes coincidirem. Dados da empresa disponíveis em todos.
        const dict = { ...companyData, ...builtinDict, ...customDict };


        // 6. Fazer os disparos para todos os templates agendados para este momento
        let disparosSuccess = 0;

        for (const template of scheduledTemplates) {
            let msg = template.content;
            Object.keys(dict).forEach(key => {
                msg = msg.split(key).join(dict[key] || '');
            });

            // Truncar se ultrapassar o limite do Telegram (4096 chars)
            if (msg.length > 4000) msg = msg.substring(0, 3900) + '\n\n... [mensagem truncada]';

            // Enviar requisição HTTPS pro Telegram (texto simples, sem parse_mode)
            const url = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`;
            try {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: settings.chat_id, text: msg }),
                });
                disparosSuccess++;
            } catch (e) {
                console.error('Falha ao enviar disparo:', template.name);
            }
        }

        // ── 7. Instagram Content Schedule (todo dia às 8h de Brasília) ──────────
        if (hour === '08') {
            try {
                const dayOfWeekParts = new Intl.DateTimeFormat('pt-BR', {
                    weekday: 'long',
                    timeZone: 'America/Sao_Paulo'
                }).formatToParts(now);
                const dayNameFull = dayOfWeekParts.find(p => p.type === 'weekday')?.value || '';

                // Mapear nome do dia para número 0-6 (Dom=0)
                const dayMap: Record<string, number> = {
                    'domingo': 0, 'segunda-feira': 1, 'terça-feira': 2,
                    'quarta-feira': 3, 'quinta-feira': 4, 'sexta-feira': 5, 'sábado': 6
                };
                const dayOfWeek = dayMap[dayNameFull.toLowerCase()];

                if (dayOfWeek !== undefined) {
                    const { data: instagramSlots } = await supabase
                        .from('instagram_schedule')
                        .select('*')
                        .eq('day_of_week', dayOfWeek)
                        .eq('active', true)
                        .eq('send_telegram_reminder', true)
                        .order('scheduled_time');

                    if (instagramSlots && instagramSlots.length > 0) {
                        const dayCapitalized = dayNameFull.charAt(0).toUpperCase() + dayNameFull.slice(1);
                        const contentEmoji: Record<string, string> = {
                            story: '📸', reels: '🎬', carrossel: '🎴', post: '📷'
                        };
                        const contentLabel: Record<string, string> = {
                            story: 'Story', reels: 'Reels', carrossel: 'Carrossel', post: 'Post Feed'
                        };

                        let instaMsg = `📅 *Cronograma Instagram — ${dayCapitalized}*\n`;
                        instaMsg += `_Seu guia completo de conteúdo para hoje. Copie e poste!_ 🚀\n`;
                        instaMsg += `${'─'.repeat(30)}\n\n`;

                        for (const slot of instagramSlots) {
                            const time = slot.scheduled_time?.slice(0, 5) || '??:??';
                            const emoji = contentEmoji[slot.content_type] || '📱';
                            const label = contentLabel[slot.content_type] || slot.content_type;

                            instaMsg += `${emoji} *${time} — ${label}*\n`;

                            if (slot.hook) {
                                instaMsg += `🎣 *Hook:* _${slot.hook.replace(/\\n/g, '\n')}_\n\n`;
                            }

                            if (slot.caption) {
                                instaMsg += `📝 *Legenda pronta:*\n${slot.caption.replace(/\\n/g, '\n')}\n\n`;
                            }

                            if (slot.cta) {
                                instaMsg += `👉 *CTA:* ${slot.cta.replace(/\\n/g, '\n')}\n`;
                            }

                            if (slot.hashtags) {
                                instaMsg += `🏷️ ${slot.hashtags}\n`;
                            }

                            if (slot.visual_notes) {
                                instaMsg += `🎨 *Visual:* ${slot.visual_notes}\n`;
                            }

                            instaMsg += `\n${'─'.repeat(30)}\n\n`;
                        }

                        instaMsg += `✅ _${instagramSlots.length} post(s) planejado(s) para hoje._\n`;
                        instaMsg += `💡 _Acesse o Estúdio de Marketing para gerar as artes!_`;

                        const instaUrl = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`;
                        await fetch(instaUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: settings.chat_id,
                                text: instaMsg,
                                parse_mode: 'Markdown'
                            }),
                        });
                    }
                }
            } catch (e) {
                console.error('Falha ao enviar cronograma Instagram:', e);
                // Não bloqueia o retorno principal
            }
        }
        // ────────────────────────────────────────────────────────────────────────

        return res.status(200).json({
            success: true,
            message: `Cron ran successfully. Dispatched ${disparosSuccess} templates.`
        });

    } catch (error: any) {
        console.error('Cron job fatal error', error);
        return res.status(500).json({ error: error.message });
    }
}

// ── Resolver inline para tags customizadas do system_tags ──────────────────
async function resolveTagInline(
    tag: any,
    supabase: any,
    now: Date,
    fmtMoney: (v: number) => string
): Promise<string> {
    const cfg = tag.resolver_config || {};

    switch (tag.resolver_type) {
        case 'static':
            return cfg.value ?? '';

        case 'date_now': {
            const tz = 'America/Sao_Paulo';
            if (cfg.format === 'time') {
                return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(now);
            }
            if (cfg.format === 'datetime') {
                return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(now);
            }
            return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).format(now);
        }

        case 'count_products': {
            let q = supabase.from('products').select('id', { count: 'exact', head: true });
            if (cfg.status) q = q.eq('status', cfg.status);
            if (cfg.min_stock != null) q = q.gt('stock_quantity', cfg.min_stock - 1);
            const { count } = await q;
            return (count ?? 0).toString();
        }

        case 'sum_products_stock': {
            let q = supabase.from('products').select('stock_quantity');
            if (cfg.status) q = q.eq('status', cfg.status);
            const { data } = await q;
            return ((data ?? []).reduce((s: number, p: any) => s + (p.stock_quantity || 0), 0)).toString();
        }

        case 'list_products': {
            const limit = cfg.limit ?? 30;
            const fmt = cfg.format ?? '• {qty}x - {name} - {color} - {ram}/{storage}';
            const { data: prods } = await supabase
                .from('products')
                .select('name, stock_quantity, specs, price_pix, price_card')
                .eq('status', 'active')
                .gt('stock_quantity', 0);

            if (!prods || prods.length === 0) return 'Nenhum item em estoque.';

            const CELULAR_KW = ['iphone', 'samsung', 'xiaomi', 'motorola', 'galaxy', 'poco', 'redmi', 'smartphone'];
            const filtered = cfg.category_slug === 'celulares'
                ? prods.filter((p: any) => CELULAR_KW.some(k => p.name.toLowerCase().includes(k)))
                : prods;

            const grouped = new Map<string, { qty: number; p: any }>();
            filtered.forEach((p: any) => {
                const color = p.specs?.color || '';
                const ram = p.specs?.ram || '';
                const storage = p.specs?.storage || '';
                const key = `${p.name}||${color}||${ram}||${storage}`;
                const ex = grouped.get(key);
                if (ex) ex.qty += p.stock_quantity || 0;
                else grouped.set(key, { qty: p.stock_quantity || 0, p });
            });

            const lines = Array.from(grouped.values())
                .sort((a, b) => b.qty - a.qty)
                .slice(0, limit)
                .map(({ qty, p }) => {
                    let line = fmt;
                    const row: Record<string, string> = {
                        qty: qty.toString(),
                        name: p.name,
                        color: p.specs?.color || '',
                        ram: p.specs?.ram || '',
                        storage: p.specs?.storage || '',
                        avg_price: p.price_pix ? fmtMoney(p.price_pix / 100) : '',
                        price_pix: p.price_pix ? fmtMoney(p.price_pix / 100) : '',
                        price_card: p.price_card ? fmtMoney(p.price_card / 100) : '',
                    };
                    Object.entries(row).forEach(([k, v]) => { line = line.split(`{${k}}`).join(v); });
                    return line;
                });

            return lines.length > 0 ? lines.join('\n') : 'Nenhum item em estoque.';
        }

        case 'count_sales_today': {
            const start = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setHours(23, 59, 59, 999);
            let q = supabase.from('sales').select('id', { count: 'exact', head: true }).gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
            if (cfg.status) q = q.eq('status', cfg.status);
            const { count } = await q;
            return (count ?? 0).toString();
        }

        case 'sum_sales_today': {
            const start = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start); end.setHours(23, 59, 59, 999);
            const field = cfg.field ?? 'total';
            let q = supabase.from('sales').select(field).gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
            if (cfg.status) q = q.eq('status', cfg.status);
            const { data } = await q;
            return fmtMoney((data ?? []).reduce((s: number, r: any) => s + (r[field] || 0), 0));
        }

        default:
            return tag.preview_value || `{${tag.name}}`;
    }
}
