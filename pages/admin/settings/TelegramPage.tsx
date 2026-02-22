import React, { useState, useEffect } from 'react';
import { Bot, Save, Send, AlertCircle, Info, Plus, Trash2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { telegramSettingsService, TelegramSettings, TelegramTemplate } from '../../../services/telegramSettings';
import { telegramBotService } from '../../../services/telegramBot';

// Um pequeno conversor Fake de Markdown para o Preview
const renderTelegramFormatting = (text: string) => {
    if (!text) return null;

    // Trocar quebras de linha
    let html = text.replace(/\n/g, '<br />');

    // Negrito *texto* -> <strong>texto</strong> e ItÃ¡lico _texto_ -> <em>texto</em>
    html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="text-sm leading-snug font-sans text-slate-800" />;
};

const DUMMY_PREVIEW_DATA = {
    id_venda: 'H78XF9A',
    cliente: 'JoÃ£o da Silva',
    telefone: '(11) 99999-0000',
    produto: 'iPhone 15 Pro Max 256GB - TitÃ¢nio Natural',
    modelo: 'iPhone 15 Pro Max',
    valor: 'R$ 7.500,00',
    lucro: 'R$ 1.200,00',
    pagamento: 'Pix, CartÃ£o de CrÃ©dito (12x)',
    desconto: 'R$ 150,00',
    estoque: '3',
    // Tags Agendadas
    qtd_vendas: '15',
    faturamento: 'R$ 18.500,00',
    lucro_total: 'R$ 3.200,00',
    data: '21/02/2026',
    estoque_celulares: '27',
    estoque_geral_loja: '450',
    estoque_lista_celulares: 'â€¢ 15x - iPhone 13 Pro Max 8GB/256GB - Azul\nâ€¢ 7x - Galaxy S24 Ultra - TitÃ¢nio\nâ€¢ 5x - Redmi Note 13',
    // Tags Cliente
    nome_cliente: 'Maria Oliveira',
    telefone_cliente: '(11) 98888-7777',
    tipo_cliente: 'Atacado'
};

const processPreviewText = (templateText: string) => {
    let simulatedText = templateText || '';
    Object.entries(DUMMY_PREVIEW_DATA).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        simulatedText = simulatedText.replace(regex, value);
    });
    return renderTelegramFormatting(simulatedText);
};

export default function TelegramPage() {
    const [settings, setSettings] = useState<TelegramSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    // Estado para gerenciar qual template estÃ¡ ativo na tela
    const [activeTemplateId, setActiveTemplateId] = useState<string>('sale_template');

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        try {
            setLoading(true);
            const data = await telegramSettingsService.getSettings();
            setSettings(data);
            if (data.templates && data.templates.length > 0) {
                // Tenta achar o sale_template, senao pega o primeiro
                const found = data.templates.find((t: TelegramTemplate) => t.id === 'sale_template');
                setActiveTemplateId(found ? found.id : data.templates[0].id);
            }
        } catch (err: any) {
            toast.error('Erro ao buscar configuraÃ§Ãµes do Telegram.');
        } finally {
            setLoading(false);
        }
    }

    // --- DICIONÃRIO E LÃ“GICA DE VARIÃVEIS INTELIGENTES ---
    const getTagsForTemplate = (templateType?: 'action' | 'scheduled', actionType?: 'sale' | 'new_customer' | null) => {
        if (templateType === 'scheduled') {
            return [
                { tag: '{qtd_vendas}', desc: 'Ex: 15 (Soma de vendas do dia)' },
                { tag: '{faturamento}', desc: 'Ex: R$ 5.000,00 (Total em R$)' },
                { tag: '{lucro_total}', desc: 'Ex: R$ 1.500,00 (Lucro puro de hoje)' },
                { tag: '{data}', desc: 'Ex: 21/05/2026 (Data do relatÃ³rio)' },
                { tag: '{estoque_celulares}', desc: 'Ex: 14 (Contagem global)' },
                { tag: '{estoque_geral_loja}', desc: 'Soma total de estoque da loja' },
                { tag: '{estoque_lista_celulares}', desc: 'Ex: 3x iPhone 15 Pro Max 256GB - Azul\n2x S24 Ultra...' },
                { tag: '{agenda_instagram_semana}', desc: 'Cronograma completo Instagram da semana (dias, legendas, CTAs, hashtags)' },
                { tag: '{empresa_nome}', desc: 'Nome da empresa' },
                { tag: '{empresa_telefone}', desc: 'Telefone/WhatsApp da loja' },
                { tag: '{empresa_endereco}', desc: 'Endereco completo' },
                { tag: '{empresa_horario}', desc: 'Horario de funcionamento' },
                { tag: '{empresa_instagram}', desc: '@instagram da loja' },
            ];
                { tag: '{agenda_instagram_semana}', desc: 'Cronograma completo Instagram da semana (todos os dias, legendas, CTAs e hashtags)' },
                { tag: '{empresa_nome}', desc: 'Nome da empresa' },
                { tag: '{empresa_telefone}', desc: 'Telefone/WhatsApp da loja' },
                { tag: '{empresa_whatsapp}', desc: 'WhatsApp da loja' },
                { tag: '{empresa_endereco}', desc: 'Endereco completo' },
                { tag: '{empresa_horario}', desc: 'Horario de funcionamento' },
                { tag: '{empresa_instagram}', desc: '@instagram da loja' },
            ];
        }

        if (actionType === 'new_customer') {
            return [
                { tag: '{nome_cliente}', desc: 'Ex: JoÃ£o da Silva' },
                { tag: '{telefone_cliente}', desc: 'Ex: (11) 99999-0000' },
                { tag: '{tipo_cliente}', desc: 'Ex: Varejo, Atacado' }
            ];
        }

        // Default: Venda 
        return [
            { tag: '{id_venda}', desc: 'ID Resumido' },
            { tag: '{cliente}', desc: 'Nome do Comprador' },
            { tag: '{telefone}', desc: 'Celular do Cliente' },
            { tag: '{produto}', desc: 'Nome do Aparelho' },
            { tag: '{modelo}', desc: 'Modelo base' },
            { tag: '{valor}', desc: 'Valor total pago' },
            { tag: '{lucro}', desc: 'Lucro daquela venda' },
            { tag: '{pagamento}', desc: 'CartÃ£o/Pix/EspÃ©cie' },
            { tag: '{desconto}', desc: 'Desconto aplicado' },
            { tag: '{estoque}', desc: 'Unidades restantes do item' }
        ];
    };

    const handleSave = async () => {
        if (!settings) return;

        if (settings.active && (!settings.bot_token || !settings.chat_id)) {
            toast.error('Para ativar a integraÃ§Ã£o, preencha o Token do Bot e o Chat ID.');
            return;
        }

        try {
            setSaving(true);
            await telegramSettingsService.updateSettings({
                active: settings.active,
                bot_token: settings.bot_token,
                chat_id: settings.chat_id,
                templates: settings.templates // Salva o array de templates
            });
            toast.success('ConfiguraÃ§Ãµes salvas com sucesso!');
        } catch (err: any) {
            toast.error('Erro ao salvar as configuraÃ§Ãµes.');
        } finally {
            setSaving(false);
        }
    };

    const handleForceTrigger = async (templateIdToDps: string) => {
        if (!settings?.bot_token || !settings?.chat_id) {
            toast.error('O Bot precisa estar salvo e configurado.');
            return;
        }

        const activeLayout = settings.templates.find(t => t.id === templateIdToDps);
        if (!activeLayout) return;

        try {
            toast.loading('Iniciando construÃ§Ã£o do relatÃ³rio...', { id: 'cron-force' });

            // Passa o ID na porta local da Vercel/Vite
            const res = await fetch(`/api/cron-dispatcher?forceTemplateId=${templateIdToDps}`, {
                method: 'POST'
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success('Disparado com sucesso! Verifique o Telegram.', { id: 'cron-force' });
            } else {
                toast.error(data.message || 'Falha ao processar o relatÃ³rio', { id: 'cron-force' });
            }
        } catch (e) {
            console.error(e);
            toast.error('Erro ao se conectar com motor de relatÃ³rios.', { id: 'cron-force' });
        }
    };

    const handleTest = async () => {
        if (!settings?.bot_token || !settings?.chat_id) {
            toast.error('Preencha e salve o Token e Chat ID antes de testar.');
            return;
        }
        try {
            setTesting(true);
            const success = await telegramBotService.sendTestMessage(settings.bot_token, settings.chat_id);
            if (success) {
                toast.success('Mensagem enviada! Verifique o Telegram.');
            } else {
                toast.error('Falha no envio.');
            }
        } catch (err) {
            toast.error('Erro ao testar bot.');
        } finally {
            setTesting(false);
        }
    };

    const handleAddTemplate = () => {
        if (!settings) return;
        if (settings.templates.length >= 10) {
            toast.error('Limite mÃ¡ximo de 10 templates atingido.');
            return;
        }

        const newId = `custom_${Date.now()}`;
        const newTemplate: TelegramTemplate = {
            id: newId,
            name: `Novo Template ${settings.templates.length + 1}`,
            type: 'scheduled', // default behavior para templates extras (relatÃ³rios customizados)
            schedule_time: '18:00',
            content: 'Digite sua mensagem aqui...\nUse *asteriscos* para negrito.'
        };

        setSettings({
            ...settings,
            templates: [...settings.templates, newTemplate]
        });
        setActiveTemplateId(newId);
    };

    const handleDeleteTemplate = (idToDelete: string) => {
        if (!settings) return;
        if (idToDelete === 'sale_template') {
            toast.error('O template de Venda PadrÃ£o nÃ£o pode ser excluÃ­do, apenas editado.');
            return;
        }
        if (idToDelete === 'new_customer_template') {
            toast.error('O template de Novo Cliente nÃ£o pode ser excluÃ­do, apenas editado.');
            return;
        }
        if (idToDelete === 'daily_report_template') {
            toast.error('O template de RelatÃ³rio DiÃ¡rio nÃ£o pode ser excluÃ­do, apenas editado.');
            return;
        }

        const filtered = settings.templates.filter(t => t.id !== idToDelete);
        setSettings({
            ...settings,
            templates: filtered
        });

        if (activeTemplateId === idToDelete) {
            setActiveTemplateId(filtered[0]?.id || 'sale_template');
        }
    };

    const updateActiveTemplateContent = (text: string) => {
        if (!settings) return;
        const updated = settings.templates.map(t =>
            t.id === activeTemplateId ? { ...t, content: text } : t
        );
        setSettings({ ...settings, templates: updated });
    };

    const updateActiveTemplateName = (name: string) => {
        if (!settings) return;
        const updated = settings.templates.map(t =>
            t.id === activeTemplateId ? { ...t, name } : t
        );
        setSettings({ ...settings, templates: updated });
    };

    const updateActiveTemplateProps = (updates: Partial<TelegramTemplate>) => {
        if (!settings) return;
        const updated = settings.templates.map(t =>
            t.id === activeTemplateId ? { ...t, ...updates } : t
        );
        setSettings({ ...settings, templates: updated });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const activeTemplate = settings?.templates.find(t => t.id === activeTemplateId) || settings?.templates[0];

    return (
        <div className="animate-in fade-in duration-500 max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Bot className="w-8 h-8 text-blue-500" />
                        AutomaÃ§Ãµes do Telegram
                    </h1>
                    <p className="text-slate-500 mt-1">Configure alertas em mÃºltiplas lÃ³gicas e regras de negÃ³cio para seu negÃ³cio.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    Salvar AlteraÃ§Ãµes
                </button>
            </div>

            {!settings ? null : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                    {/* LADO ESQUERDO: Credenciais e Lista de Templates (4 Colunas) */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* Bloco 1: Master Switch & Credenciais */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-indigo-500" />
                                    ConexÃ£o com Bot
                                </h2>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <span className={`text-xs font-semibold ${settings.active ? 'text-green-600' : 'text-slate-500'}`}>
                                        {settings.active ? 'Ativado' : 'Inativo'}
                                    </span>
                                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.active ? 'bg-green-500' : 'bg-slate-300'}`}>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={settings.active}
                                            onChange={(e) => setSettings({ ...settings, active: e.target.checked })}
                                        />
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.active ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </div>
                                </label>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Token do Bot</label>
                                    <input
                                        type="password"
                                        value={settings.bot_token || ''}
                                        onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })}
                                        className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                        placeholder="Ex: 8159902559:AAFGPR285..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">ID do Chat Recebedor</label>
                                    <input
                                        type="text"
                                        value={settings.chat_id || ''}
                                        onChange={(e) => setSettings({ ...settings, chat_id: e.target.value })}
                                        className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                        placeholder="Ex: -10023456789"
                                    />
                                </div>

                                <div className="pt-3 flex justify-end">
                                    <button
                                        onClick={handleTest}
                                        disabled={testing}
                                        className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
                                    >
                                        {testing ? <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
                                        Testar ConexÃ£o
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bloco 2: Lista de Templates EditÃ¡veis */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-bold flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-blue-500" />
                                    Templates ({settings.templates.length}/10)
                                </h2>
                                <button
                                    onClick={handleAddTemplate}
                                    disabled={settings.templates.length >= 10}
                                    className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {settings.templates.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => setActiveTemplateId(t.id)}
                                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center group
                      ${activeTemplateId === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-300'}`}
                                    >
                                        <div>
                                            <p className={`text-sm font-bold ${activeTemplateId === t.id ? 'text-blue-800' : 'text-slate-700'}`}>
                                                {t.name}
                                            </p>
                                            {t.id === 'sale_template' && (
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">Gatilho Venda PDV</p>
                                            )}
                                            {t.id === 'new_customer_template' && (
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">Gatilho Novo Cliente</p>
                                            )}
                                            {t.id === 'daily_report_template' && (
                                                <p className="text-[10px] text-green-600 uppercase tracking-wider font-bold mt-0.5">AutomÃ¡tico ({t.schedule_time})</p>
                                            )}
                                            {t.id !== 'sale_template' && t.id !== 'new_customer_template' && t.id !== 'daily_report_template' && (
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-0.5">
                                                    {t.type === 'action' ? 'Gatilho Customizado' : `Agendado (${t.schedule_time})`}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            {t.type === 'scheduled' && activeTemplateId === t.id && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleForceTrigger(t.id); }}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-100/50 rounded-md transition-colors"
                                                    title="Disparar RelatÃ³rio Agora"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            )}
                                            {t.id !== 'sale_template' && t.id !== 'new_customer_template' && t.id !== 'daily_report_template' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                    title="Excluir Template"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* LADO DIREITO: Editor e Live Preview (8 Colunas) */}
                    <div className="lg:col-span-8 flex flex-col md:flex-row gap-6">

                        {/* O Editor (50% do espaÃ§o restante) */}
                        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
                            {activeTemplate ? (
                                <>
                                    {/* Linha 1: Nome e Contextos */}
                                    <div className="flex gap-3 mb-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Nome de ExibiÃ§Ã£o do Template</label>
                                            <input
                                                type="text"
                                                value={activeTemplate.name}
                                                onChange={(e) => updateActiveTemplateName(e.target.value)}
                                                disabled={activeTemplate.id === 'sale_template' || activeTemplate.id === 'new_customer_template' || activeTemplate.id === 'daily_report_template'}
                                                className="w-full px-3 py-2 text-sm font-bold border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50 disabled:bg-slate-50"
                                            />
                                        </div>

                                        {(activeTemplate.id !== 'sale_template' && activeTemplate.id !== 'new_customer_template' && activeTemplate.id !== 'daily_report_template') && (
                                            <>
                                                <div className="w-40 flex-shrink-0">
                                                    <label className="block text-xs font-medium text-slate-700 mb-1">Tipo da AutomaÃ§Ã£o</label>
                                                    <select
                                                        value={activeTemplate.type}
                                                        onChange={(e) => updateActiveTemplateProps({ type: e.target.value as 'action' | 'scheduled' })}
                                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                                    >
                                                        <option value="scheduled">Agendado (Hora)</option>
                                                        <option value="action">De Gatilho (Manual)</option>
                                                    </select>
                                                </div>

                                                {activeTemplate.type === 'scheduled' && (
                                                    <div className="w-24 flex-shrink-0">
                                                        <label className="block text-xs font-medium text-amber-700 mb-1">HorÃ¡rio</label>
                                                        <input
                                                            type="time"
                                                            value={activeTemplate.schedule_time || '18:00'}
                                                            onChange={(e) => updateActiveTemplateProps({ schedule_time: e.target.value })}
                                                            className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50"
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <p className="text-xs font-semibold text-slate-600 uppercase mb-2">Editor de Mensagem</p>
                                    <textarea
                                        value={activeTemplate.content}
                                        onChange={(e) => updateActiveTemplateContent(e.target.value)}
                                        className="w-full flex-1 min-h-[300px] px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-slate-50 resize-y font-mono text-sm leading-relaxed"
                                        placeholder="Construa seu template aqui..."
                                    />

                                    <div className="mt-4 border-t pt-4">
                                        <p className="text-xs font-semibold text-slate-700 uppercase mb-1.5 flex items-center gap-2">
                                            <Info className="w-4 h-4 text-blue-500" />
                                            Contextos & Tags Recomendadas
                                        </p>
                                        <p className="text-[11px] text-slate-500 mb-3">Clique em uma tag para copiar e cole no seu texto acima. O Preview simularÃ¡ valores falsos pra vocÃª.</p>
                                        <div className="flex flex-wrap gap-2">
                                            {getTagsForTemplate(activeTemplate.type, activeTemplate.action_type).map(item => (
                                                <div
                                                    key={item.tag}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(item.tag);
                                                        toast.success(`Tag ${item.tag} copiada!`);
                                                    }}
                                                    className="p-2 border rounded-md cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-start gap-1 flex-1 min-w-[140px] max-w-[200px]"
                                                >
                                                    <span className="text-xs font-mono font-bold text-blue-700 px-1 py-0.5 bg-blue-100 rounded break-all">{item.tag}</span>
                                                    <span className="text-[10px] text-slate-500 whitespace-pre-wrap leading-tight max-w-full overflow-hidden text-ellipsis">{item.desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center flex-1 text-slate-400">Selecione um template...</div>
                            )}
                        </div>

                        {/* O Chat Simulador Apple / Telegram (50% do espaco restante) */}
                        <div className="w-[340px] flex-shrink-0 bg-[#e5e5ea] rounded-3xl overflow-hidden border-[6px] border-slate-800 shadow-2xl relative">
                            {/* Header Falso iPhone */}
                            <div className="bg-slate-100 pt-4 pb-2 px-4 shadow-sm z-10 relative flex flex-col items-center border-b border-slate-300">
                                <div className="w-16 h-1 bg-slate-300 rounded-full mb-2" />
                                <p className="font-bold text-sm text-slate-800">Bot da Empresa ðŸ¤–</p>
                                <p className="text-[10px] text-slate-500">bot</p>
                            </div>

                            {/* Corpo do Chat */}
                            <div className="p-4 h-[420px] overflow-y-auto bg-[#c5e2a2] flex flex-col justify-end" style={{ backgroundImage: "url('https://web.telegram.org/a/bg-pattern.png')", backgroundSize: 'cover', backgroundBlendMode: 'overlay', backgroundColor: '#e2ebf0' }}>

                                <div className="flex justify-start w-full drop-shadow-sm mb-2">
                                    <div className="bg-white p-3 rounded-2xl rounded-tl-none relative max-w-[90%]">
                                        {/* O ConteÃºdo renderizado pelo mock de Markdown */}
                                        {processPreviewText(activeTemplate?.content || '')}
                                        <p className="text-[9px] text-slate-400 absolute bottom-1.5 right-2 mt-1text-right">Agora</p>
                                    </div>
                                </div>

                            </div>

                        </div>

                    </div>

                </div>
            )}
        </div>
    );
}
