import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Copy, Plus, Save, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { analyzeShopeeTitleSafety, applyShopeeTemplateToProduct } from '../../../services/shopeeTemplateEngine';
import { DEFAULT_SHOPEE_TEMPLATES, shopeeTemplateService } from '../../../services/shopeeTemplateService';
import type { ShopeeDangerousTermRule, ShopeeTemplate } from '../../../types/shopee-template';

const emptyTemplate = (): ShopeeTemplate => ({
    id: `draft-${Date.now()}`,
    name: 'Novo template',
    active: true,
    priority: 10,
    rules: {
        nameIncludes: [],
        skuIncludes: [],
        brandIncludes: [],
        modelIncludes: [],
    },
    titleTemplate: '{nome}',
    descriptionTemplate: '{descricao}',
    shopeeCategoryId: null,
    shopeeCategoryName: '',
    attributeDefaults: {},
    priceMode: 'product',
    stockMode: 'product',
    dimensionMode: 'product',
    gtinMode: 'product',
    dangerousTerms: [],
});

const sampleProduct = {
    id: 'sample',
    name: 'Capa para Iphone 13 Cor:Vermelho',
    sku: 'CAPA-IP13-VERM',
    brand: 'Apple',
    model: 'iPhone 13',
    category_slug: 'capas',
    specs: { color: 'Vermelho', ram: '4GB', storage: '128GB' },
    price_retail: 1490,
    stock_quantity: 3,
};

function csvToList(value: string): string[] {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function listToCsv(value?: string[]): string {
    return (value || []).join(', ');
}

function parseAttributeDefaults(value: string): Record<string, string | string[]> {
    try {
        const parsed = JSON.parse(value || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function makeDangerousRule(): ShopeeDangerousTermRule {
    return {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        term: '',
        replacement: '',
        level: 'warning',
        active: true,
    };
}

export default function ShopeeTemplatesPage() {
    const [templates, setTemplates] = useState<ShopeeTemplate[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [draft, setDraft] = useState<ShopeeTemplate>(emptyTemplate());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [attributeJson, setAttributeJson] = useState('{}');

    const selectedTemplate = useMemo(
        () => templates.find((template) => template.id === selectedId) || null,
        [selectedId, templates]
    );

    const preview = useMemo(() => applyShopeeTemplateToProduct(sampleProduct, draft), [draft]);
    const safety = useMemo(() => analyzeShopeeTitleSafety(preview.title, draft.dangerousTerms), [draft.dangerousTerms, preview.title]);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await shopeeTemplateService.list();
            const nextTemplates = data.length > 0 ? data : DEFAULT_SHOPEE_TEMPLATES;
            setTemplates(nextTemplates);
            const first = nextTemplates[0] || emptyTemplate();
            setSelectedId(first.id);
            setDraft(first);
            setAttributeJson(JSON.stringify(first.attributeDefaults || {}, null, 2));
        } catch (error) {
            console.error('[ShopeeTemplatesPage] load error:', error);
            toast.error('Nao foi possivel carregar templates da Shopee.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    useEffect(() => {
        if (!selectedTemplate) return;
        setDraft(selectedTemplate);
        setAttributeJson(JSON.stringify(selectedTemplate.attributeDefaults || {}, null, 2));
    }, [selectedTemplate]);

    const updateDraft = (updates: Partial<ShopeeTemplate>) => {
        setDraft((current) => ({ ...current, ...updates }));
    };

    const handleNew = () => {
        const next = emptyTemplate();
        setTemplates((current) => [next, ...current]);
        setSelectedId(next.id);
        setDraft(next);
        setAttributeJson('{}');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...draft,
                attributeDefaults: parseAttributeDefaults(attributeJson),
            };

            const isDraft = String(draft.id).startsWith('draft-');
            const saved = isDraft
                ? await shopeeTemplateService.create(payload)
                : await shopeeTemplateService.update(draft.id, payload);

            setTemplates((current) => {
                const withoutOld = current.filter((template) => template.id !== draft.id && template.id !== saved.id);
                return [saved, ...withoutOld].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
            });
            setSelectedId(saved.id);
            setDraft(saved);
            toast.success('Template da Shopee salvo.');
        } catch (error) {
            console.error('[ShopeeTemplatesPage] save error:', error);
            toast.error('Erro ao salvar template.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedId) return;
        if (!confirm(`Excluir o template "${draft.name}"?`)) return;

        await shopeeTemplateService.remove(selectedId);
        const remaining = templates.filter((template) => template.id !== selectedId);
        setTemplates(remaining);
        const next = remaining[0] || emptyTemplate();
        setSelectedId(next.id);
        setDraft(next);
        setAttributeJson(JSON.stringify(next.attributeDefaults || {}, null, 2));
        toast.success('Template removido.');
    };

    const updateDangerousRule = (id: string, updates: Partial<ShopeeDangerousTermRule>) => {
        updateDraft({
            dangerousTerms: draft.dangerousTerms.map((rule) => rule.id === id ? { ...rule, ...updates } : rule),
        });
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link to="/admin/settings/shopee" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-orange-600">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para Shopee
                    </Link>
                    <h1 className="mt-2 text-2xl font-bold text-slate-900">Templates da Shopee</h1>
                    <p className="text-sm text-slate-500">Crie modelos completos com titulo seguro, categoria, atributos e alertas antes de publicar.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleNew} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <Plus className="h-4 w-4" />
                        Novo template
                    </button>
                    <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                        <Save className="h-4 w-4" />
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 p-4">
                        <p className="text-sm font-semibold text-slate-800">Templates cadastrados</p>
                        <p className="text-xs text-slate-500">{loading ? 'Carregando...' : `${templates.length} modelos`}</p>
                    </div>
                    <div className="max-h-[720px] overflow-y-auto p-2">
                        {templates.map((template) => (
                            <button
                                key={template.id}
                                onClick={() => setSelectedId(template.id)}
                                className={`mb-2 w-full rounded-lg border p-3 text-left transition ${selectedId === template.id ? 'border-orange-300 bg-orange-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{template.name}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${template.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {template.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{template.titleTemplate || 'Sem titulo sugerido'}</p>
                            </button>
                        ))}
                    </div>
                </aside>

                <main className="space-y-5">
                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <label className="md:col-span-2">
                                <span className="text-xs font-semibold uppercase text-slate-500">Nome do template</span>
                                <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                            <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">Prioridade</span>
                                <input type="number" value={draft.priority} onChange={(event) => updateDraft({ priority: Number(event.target.value) || 0 })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                        </div>
                        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input type="checkbox" checked={draft.active} onChange={(event) => updateDraft({ active: event.target.checked })} />
                            Template ativo para sugestao automatica
                        </label>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-bold text-slate-900">Regras de aplicacao</h2>
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">Palavras no nome</span>
                                <input value={listToCsv(draft.rules.nameIncludes)} onChange={(event) => updateDraft({ rules: { ...draft.rules, nameIncludes: csvToList(event.target.value) } })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="capa, capinha, case" />
                            </label>
                            <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">Palavras no SKU</span>
                                <input value={listToCsv(draft.rules.skuIncludes)} onChange={(event) => updateDraft({ rules: { ...draft.rules, skuIncludes: csvToList(event.target.value) } })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="capa, case" />
                            </label>
                            <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">Marcas</span>
                                <input value={listToCsv(draft.rules.brandIncludes)} onChange={(event) => updateDraft({ rules: { ...draft.rules, brandIncludes: csvToList(event.target.value) } })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="apple, samsung, xiaomi" />
                            </label>
                            <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">Categoria local</span>
                                <input value={draft.rules.categoryId || ''} onChange={(event) => updateDraft({ rules: { ...draft.rules, categoryId: event.target.value || undefined } })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="ID da categoria local" />
                            </label>
                        </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-bold text-slate-900">Titulo sugerido e descricao</h2>
                        <div className="mt-4 space-y-4">
                            <label className="block">
                                <span className="text-xs font-semibold uppercase text-slate-500">Titulo sugerido</span>
                                <input value={draft.titleTemplate} onChange={(event) => updateDraft({ titleTemplate: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Capa compativel com {modelo} Cor:{cor}" />
                            </label>
                            <label className="block">
                                <span className="text-xs font-semibold uppercase text-slate-500">Descricao sugerida</span>
                                <textarea value={draft.descriptionTemplate} onChange={(event) => updateDraft({ descriptionTemplate: event.target.value })} rows={5} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                        </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-bold text-slate-900">Categoria e atributos Shopee</h2>
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">ID da categoria Shopee</span>
                                <input type="number" value={draft.shopeeCategoryId || ''} onChange={(event) => updateDraft({ shopeeCategoryId: Number(event.target.value) || null })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                            <label>
                                <span className="text-xs font-semibold uppercase text-slate-500">Nome da categoria</span>
                                <input value={draft.shopeeCategoryName || ''} onChange={(event) => updateDraft({ shopeeCategoryName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                            </label>
                        </div>
                        <label className="mt-4 block">
                            <span className="text-xs font-semibold uppercase text-slate-500">Atributos padrao em JSON</span>
                            <textarea value={attributeJson} onChange={(event) => setAttributeJson(event.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" />
                        </label>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="text-base font-bold text-slate-900">Termos perigosos</h2>
                        <div className="mt-4 space-y-3">
                            {draft.dangerousTerms.map((rule) => (
                                <div key={rule.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-3 md:grid-cols-[1fr_1fr_120px_40px]">
                                    <input value={rule.term} onChange={(event) => updateDangerousRule(rule.id, { term: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Termo perigoso" />
                                    <input value={rule.replacement || ''} onChange={(event) => updateDangerousRule(rule.id, { replacement: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Sugestao segura" />
                                    <select value={rule.level} onChange={(event) => updateDangerousRule(rule.id, { level: event.target.value as 'warning' | 'block' })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                        <option value="warning">Aviso</option>
                                        <option value="block">Bloqueio</option>
                                    </select>
                                    <button onClick={() => updateDraft({ dangerousTerms: draft.dangerousTerms.filter((entry) => entry.id !== rule.id) })} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Remover regra">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => updateDraft({ dangerousTerms: [...draft.dangerousTerms, makeDangerousRule()] })} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                <ShieldAlert className="h-4 w-4" />
                                Adicionar termo
                            </button>
                        </div>
                    </section>

                    <section className="rounded-lg border border-slate-200 bg-white p-5">
                        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                            <Sparkles className="h-4 w-4 text-orange-500" />
                            Previa com produto exemplo
                        </h2>
                        <div className="mt-4 rounded-lg bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-slate-500">Titulo final</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{safety.suggestedTitle || preview.title}</p>
                                </div>
                                <button onClick={() => navigator.clipboard.writeText(safety.suggestedTitle || preview.title)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800" title="Copiar titulo">
                                    <Copy className="h-4 w-4" />
                                </button>
                            </div>
                            {safety.matches.length > 0 && (
                                <div className={`mt-3 rounded-lg border p-3 text-sm ${safety.hasBlocks ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                    <div className="flex items-center gap-2 font-semibold">
                                        <AlertTriangle className="h-4 w-4" />
                                        {safety.hasBlocks ? 'Titulo com bloqueio' : 'Titulo com aviso'}
                                    </div>
                                    <p className="mt-1 text-xs">Sugestao: {safety.suggestedTitle}</p>
                                </div>
                            )}
                            <p className="mt-4 whitespace-pre-line text-xs text-slate-600">{preview.description}</p>
                        </div>
                    </section>

                    <div className="flex justify-between">
                        <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                            Excluir
                        </button>
                        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                            <Save className="h-4 w-4" />
                            Salvar template
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}
