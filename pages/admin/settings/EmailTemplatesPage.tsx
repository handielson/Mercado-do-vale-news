import React, { useEffect, useMemo, useState } from 'react';
import { Code2, Copy, Eye, FileText, Mail, Plus, Save, Type } from 'lucide-react';
import { toast } from 'sonner';
import { EmailTemplate, emailTemplatesService } from '../../../services/emailTemplatesService';

const SAMPLE_VALUES: Record<string, string> = {
    '{{cliente_nome}}': 'Maria Silva',
    '{{pedido_numero}}': '10294',
    '{{pedido_total}}': 'R$ 2.499,00',
    '{{pedido_itens}}': '1x Redmi Note 13 Pro 256GB',
    '{{pedido_link}}': 'https://www.mercadodovale.com.br/pedido/10294',
    '{{promocao_titulo}}': 'Semana de ofertas Xiaomi',
    '{{promocao_descricao}}': 'Celulares, capas e carregadores com condicoes especiais.',
    '{{promocao_link}}': 'https://www.mercadodovale.com.br/promocoes',
    '{{promocao_validade}}': 'domingo',
    '{{produtos_novos}}': '<ul><li>Poco X6 Pro 512GB</li><li>Redmi Watch 4</li></ul>',
    '{{catalogo_link}}': 'https://www.mercadodovale.com.br/produtos/mais-recentes',
    '{{reset_link}}': 'https://www.mercadodovale.com.br/redefinir-senha?token=exemplo',
    '{{expira_em_minutos}}': '60',
    '{{login_link}}': 'https://www.mercadodovale.com.br/cliente/login',
    '{{confirmacao_link}}': 'https://www.mercadodovale.com.br/confirmar-email?token=exemplo',
};

const CATEGORY_LABELS: Record<string, string> = {
    sales: 'Vendas',
    marketing: 'Marketing',
    catalog: 'Catalogo',
    auth: 'Cadastro',
    custom: 'Personalizado',
};

function renderPreview(value: string): string {
    return Object.entries(SAMPLE_VALUES).reduce(
        (html, [key, sample]) => html.split(key).join(sample),
        value || ''
    );
}

function joinVariables(variables: string[]): string {
    return (variables || []).join(', ');
}

function splitVariables(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [draft, setDraft] = useState<EmailTemplate | null>(null);
    const [variablesInput, setVariablesInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selected = useMemo(
        () => templates.find((template) => template.id === selectedId) || null,
        [selectedId, templates]
    );

    const previewHtml = useMemo(() => renderPreview(draft?.html_body || ''), [draft?.html_body]);
    const previewSubject = useMemo(() => renderPreview(draft?.subject || ''), [draft?.subject]);
    const previewPreheader = useMemo(() => renderPreview(draft?.preheader || ''), [draft?.preheader]);

    async function loadTemplates() {
        try {
            setLoading(true);
            const data = await emailTemplatesService.listTemplates();
            setTemplates(data);
            const first = data[0] || null;
            setSelectedId(first?.id || '');
            setDraft(first);
            setVariablesInput(first ? joinVariables(first.variables) : '');
        } catch (error) {
            console.error('[EmailTemplatesPage] load error:', error);
            toast.error('Nao foi possivel carregar os templates de e-mail.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadTemplates();
    }, []);

    function selectTemplate(template: EmailTemplate) {
        setSelectedId(template.id);
        setDraft(template);
        setVariablesInput(joinVariables(template.variables));
    }

    function updateDraft(updates: Partial<EmailTemplate>) {
        setDraft((current) => current ? { ...current, ...updates } : current);
    }

    function insertVariable(variable: string) {
        updateDraft({ html_body: `${draft?.html_body || ''}${variable}` });
    }

    async function handleCreate() {
        try {
            setSaving(true);
            const created = await emailTemplatesService.createTemplate();
            const next = [...templates, created];
            setTemplates(next);
            selectTemplate(created);
            toast.success('Template criado.');
        } catch (error) {
            console.error('[EmailTemplatesPage] create error:', error);
            toast.error('Nao foi possivel criar o template.');
        } finally {
            setSaving(false);
        }
    }

    async function handleSave() {
        if (!draft) return;
        if (!draft.name.trim() || !draft.subject.trim() || !draft.html_body.trim()) {
            toast.error('Nome, assunto e HTML sao obrigatorios.');
            return;
        }

        try {
            setSaving(true);
            const saved = await emailTemplatesService.saveTemplate({
                ...draft,
                variables: splitVariables(variablesInput),
            });
            setTemplates((current) => current.map((template) => template.id === saved.id ? saved : template));
            setDraft(saved);
            setVariablesInput(joinVariables(saved.variables));
            toast.success('Template salvo.');
        } catch (error) {
            console.error('[EmailTemplatesPage] save error:', error);
            toast.error('Nao foi possivel salvar o template.');
        } finally {
            setSaving(false);
        }
    }

    async function copyHtml() {
        if (!draft?.html_body) return;
        await navigator.clipboard?.writeText(draft.html_body);
        toast.success('HTML copiado.');
    }

    if (loading) {
        return (
            <div className="flex min-h-[360px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                        <Mail size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">E-mail</h1>
                        <p className="text-sm text-slate-600">Templates HTML editaveis para vendas, marketing, catalogo e cadastro.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        <Plus size={16} /> Criar template
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !draft}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="space-y-3">
                    {templates.map((template) => (
                        <button
                            key={template.id}
                            type="button"
                            onClick={() => selectTemplate(template)}
                            className={`w-full rounded-lg border p-4 text-left transition-colors ${
                                selectedId === template.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-slate-900">{template.name}</p>
                                    <p className="mt-1 text-xs text-slate-500">{CATEGORY_LABELS[template.category] || template.category}</p>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                    template.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {template.active ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>
                            <p className="mt-3 line-clamp-2 text-xs text-slate-500">{template.subject}</p>
                        </button>
                    ))}
                </aside>

                {draft && (
                    <section className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Type size={16} /> Nome</span>
                                <input
                                    value={draft.name}
                                    onChange={(event) => updateDraft({ name: event.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                            <label className="space-y-2">
                                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FileText size={16} /> Assunto</span>
                                <input
                                    value={draft.subject}
                                    onChange={(event) => updateDraft({ subject: event.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                            <label className="space-y-2 md:col-span-2">
                                <span className="text-sm font-semibold text-slate-700">Preheader</span>
                                <input
                                    value={draft.preheader || ''}
                                    onChange={(event) => updateDraft({ preheader: event.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        </div>

                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <p className="mb-3 text-sm font-semibold text-blue-950">Variaveis dinamicas</p>
                            <div className="flex flex-wrap gap-2">
                                {splitVariables(variablesInput).map((variable) => (
                                    <button
                                        key={variable}
                                        type="button"
                                        onClick={() => insertVariable(variable)}
                                        className="rounded-full border border-blue-300 bg-white px-3 py-1 font-mono text-xs text-blue-700 hover:bg-blue-100"
                                    >
                                        {variable}
                                    </button>
                                ))}
                            </div>
                            <input
                                value={variablesInput}
                                onChange={(event) => setVariablesInput(event.target.value)}
                                className="mt-3 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                placeholder="{{cliente_nome}}, {{pedido_link}}"
                            />
                        </div>

                        <div className="grid gap-5 xl:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Code2 size={16} /> HTML do template</span>
                                    <button type="button" onClick={copyHtml} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900">
                                        <Copy size={14} /> Copiar
                                    </button>
                                </div>
                                <textarea
                                    value={draft.html_body}
                                    onChange={(event) => updateDraft({ html_body: event.target.value })}
                                    rows={18}
                                    className="h-[430px] w-full resize-none rounded-lg border border-slate-300 px-4 py-3 font-mono text-xs leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div className="space-y-3">
                                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Eye size={16} /> Preview</span>
                                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                                        <p className="text-sm font-semibold text-slate-900">{previewSubject || 'Assunto'}</p>
                                        <p className="mt-1 text-xs text-slate-500">{previewPreheader || 'Preheader do e-mail'}</p>
                                    </div>
                                    <div className="h-[372px] overflow-auto p-5">
                                        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                    </div>
                                </div>

                                <label className="block space-y-2">
                                    <span className="text-sm font-semibold text-slate-700">Fallback em texto</span>
                                    <textarea
                                        value={draft.text_body || ''}
                                        onChange={(event) => updateDraft({ text_body: event.target.value })}
                                        rows={5}
                                        className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>

                                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={draft.active}
                                        onChange={(event) => updateDraft({ active: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    Template ativo
                                </label>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
