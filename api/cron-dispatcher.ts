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
            .select('name, stock_quantity, specs, category_id, model_id')
            .eq('status', 'active')
            .gt('stock_quantity', 0);

        let estoqueCelularesTotal = 0;
        let estoqueGeralTotal = 0;
        let celularListStr = '';

        if (!productsError && products) {
            const celularesMap = new Map<string, number>();

            products.forEach(p => {
                const qtd = p.stock_quantity || 0;
                estoqueGeralTotal += qtd;

                // Heurística segura: assumindo que Celulares/Smartphones contem certas keywords na categoria ou nome (ex: iPhone, Galaxy, Xiaomi)
                // Caso sua tabela tenha um group fixo, você ajusta aqui. Vou agrupar por nome robusto.
                const nameLower = p.name.toLowerCase();
                const isCelular = nameLower.includes('iphone') || nameLower.includes('samsung') || nameLower.includes('xiaomi') || nameLower.includes('motorola') || nameLower.includes('smartphone') || nameLower.includes('galaxy') || nameLower.includes('poco') || nameLower.includes('redmi');

                if (isCelular) {
                    estoqueCelularesTotal += qtd;
                    // Agrupa por nome + cor + memória para diferenciar variantes
                    const color = p.specs?.color || p.specs?.cor || '';
                    const ram = p.specs?.ram || '';
                    const storage = p.specs?.storage || '';
                    const memory = ram && storage ? `${ram}/${storage}` : (ram || storage);
                    const variant = [color, memory].filter(Boolean).join(' - ');
                    const groupingKey = variant ? `${p.name} - ${variant}` : p.name;

                    celularesMap.set(groupingKey, (celularesMap.get(groupingKey) || 0) + qtd);
                }
            });

            const sortedList = Array.from(celularesMap.entries())
                .sort((a, b) => b[1] - a[1]) // Ordernar por quem tem mais estoque primeiro
                .map(([itemName, qtd]) => `• ${qtd}x - ${itemName}`);

            celularListStr = sortedList.length > 0 ? sortedList.join('\n') : 'Nenhum celular em estoque.';
        }

        // 5. Preparar o Dicionário de Variáveis
        const dict: any = {
            '{qtd_vendas}': qtd_vendas.toString(),
            '{faturamento}': fmtMoney(faturamento),
            '{lucro_total}': fmtMoney(lucro_total),
            '{data}': dateFormatter.format(now),
            '{estoque_celulares}': estoqueCelularesTotal.toString(),
            '{estoque_geral_loja}': estoqueGeralTotal.toString(),
            '{estoque_lista_celulares}': celularListStr,
        };

        // 6. Fazer os disparos para todos os templates agendados para este momento
        let disparosSuccess = 0;

        for (const template of scheduledTemplates) {
            let msg = template.content;
            Object.keys(dict).forEach(key => {
                msg = msg.split(key).join(dict[key] || '');
            });

            // Enviar requisição HTTPS pro Telegram
            const url = `https://api.telegram.org/bot${settings.bot_token}/sendMessage`;
            try {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: settings.chat_id, text: msg, parse_mode: 'Markdown' }),
                });
                disparosSuccess++;
            } catch (e) {
                console.error('Falha ao enviar disparo:', template.name);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Cron ran successfully. Dispatched ${disparosSuccess} templates.`
        });

    } catch (error: any) {
        console.error('Cron job fatal error', error);
        return res.status(500).json({ error: error.message });
    }
}
