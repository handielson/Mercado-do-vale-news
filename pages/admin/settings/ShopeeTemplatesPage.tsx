import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Copy, Loader2, Plus, Save, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { categoryService } from '../../../services/categories';
import { analyzeShopeeTitleSafety, applyShopeeTemplateToProduct } from '../../../services/shopeeTemplateEngine';
import { DEFAULT_SHOPEE_TEMPLATES, shopeeTemplateService } from '../../../services/shopeeTemplateService';
import type { Category } from '../../../types/category';
import type { ShopeeDangerousTermRule, ShopeeTemplate } from '../../../types/shopee-template';

type ShopeeTemplateAttributeOption = {
    value_id: number;
    label: string;
    raw_name: string;
    original_value_name: string;
};

type ShopeeTemplateAttributeField = {
    attribute_id: number;
    label: string;
    mandatory: boolean;
    input_kind: 'select' | 'multiselect' | 'text';
    attribute_value_list: ShopeeTemplateAttributeOption[];
};

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

function makeDangerousRule(): ShopeeDangerousTermRule {
    return {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        term: '',
        replacement: '',
        level: 'warning',
        active: true,
    };
}

function translateShopeeText(entity: any, fallbackKeys: string[] = []): string {
    if (Array.isArray(entity?.multi_lang)) {
        const localized = entity.multi_lang.find((entry: any) => {
            const language = String(entry?.language || '').toLowerCase();
            return language === 'pt-br' || language === 'pt_br' || language.startsWith('pt');
        });
        if (typeof localized?.value === 'string' && localized.value.trim()) {
            return localized.value.trim();
        }
    }

    for (const key of fallbackKeys) {
        const value = entity?.[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return '';
}

function extractShopeeAttributeTree(data: any): any[] {
    if (Array.isArray(data?.response?.attribute_list)) return data.response.attribute_list;
    if (Array.isArray(data?.response?.attribute_tree)) return data.response.attribute_tree;
    if (Array.isArray(data?.response?.list)) {
        const entryWithTree = data.response.list.find((entry: any) => Array.isArray(entry?.attribute_tree));
        if (entryWithTree?.attribute_tree) return entryWithTree.attribute_tree;
    }
    return [];
}

function normalizeShopeeTemplateAttributes(data: any): ShopeeTemplateAttributeField[] {
    return extractShopeeAttributeTree(data)
        .map((attr: any) => {
            const rawInputType = attr?.input_type ?? attr?.attribute_type ?? '';
            const inputTypeText = String(rawInputType).toUpperCase();
            const options = Array.isArray(attr?.attribute_value_list)
                ? attr.attribute_value_list
                    .map((option: any) => {
                        const label =
                            translateShopeeText(option, ['display_attribute_value', 'display_value_name', 'name', 'original_value_name']) ||
                            String(option?.value_id || '').trim();
                        return {
                            value_id: Number(option?.value_id) || 0,
                            label,
                            raw_name: String(option?.name || option?.display_attribute_value || label).trim(),
                            original_value_name: String(option?.original_value_name || option?.name || option?.display_attribute_value || label).trim(),
                        };
                    })
                    .filter((option: ShopeeTemplateAttributeOption) => option.label)
                : [];

            const allowsMultiple =
                inputTypeText.includes('MULTIPLE') ||
                attr?.multiple_select === true ||
                attr?.is_multiple === true ||
                attr?.multiple_enter === true;

            return {
                attribute_id: Number(attr?.attribute_id) || 0,
                label:
                    translateShopeeText(attr, ['display_attribute_name', 'name', 'original_attribute_name']) ||
                    `Atributo ${attr?.attribute_id || ''}`.trim(),
                mandatory: Boolean(attr?.mandatory ?? attr?.is_mandatory),
                input_kind: options.length > 0 ? (allowsMultiple ? 'multiselect' : 'select') : 'text',
                attribute_value_list: options,
            } satisfies ShopeeTemplateAttributeField;
        })
        .filter((attr: ShopeeTemplateAttributeField) => Number.isFinite(attr.attribute_id) && attr.attribute_id > 0);
}

export default function ShopeeTemplatesPage() {
    const [templates, setTemplates] = useState<ShopeeTemplate[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [draft, setDraft] = useState<ShopeeTemplate>(emptyTemplate());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [localCategories, setLocalCategories] = useState<Category[]>([]);
    const [shopeeAttributes, setShopeeAttributes] = useState<ShopeeTemplateAttributeField[]>([]);
    const [loadingShopeeAttributes, setLoadingShopeeAttributes] = useState(false);

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
        categoryService.list()
            .then(setLocalCategories)
            .catch((error) => {
                console.warn('[ShopeeTemplatesPage] categories load error:', error);
                toast.error('Nao foi possivel carregar categorias locais.');
            });
    }, []);

    useEffect(() => {
        if (!selectedTemplate) return;
        setDraft(selectedTemplate);
    }, [selectedTemplate]);

    useEffect(() => {
        if (!draft.shopeeCategoryId) {
            setShopeeAttributes([]);
            return;
        }

        let cancelled = false;
        setLoadingShopeeAttributes(true);

        fetch(`/api/shopee-catalog?action=attributes&category_id=${draft.shopeeCategoryId}`)
            .then((response) => response.json())
            .then((data) => {
                if (cancelled) return;
                setShopeeAttributes(normalizeShopeeTemplateAttributes(data));
            })
            .catch((error) => {
                if (!cancelled) {
                    console.error('[ShopeeTemplatesPage] attributes load error:', error);
                    toast.error('Nao foi possivel carregar os campos da categoria Shopee.');
                    setShopeeAttributes([]);
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingShopeeAttributes(false);
            });

        return () => {
            cancelled = true;
        };
    }, [draft.shopeeCategoryId]);

    const updateDraft = (updates: Partial<ShopeeTemplate>) => {
        setDraft((current) => ({ ...current, ...updates }));
    };

    const handleNew = () => {
        const next = emptyTemplate();
        setTemplates((current) => [next, ...current]);
        setSelectedId(next.id);
        setDraft(next);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                ...draft,
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
        toast.success('Template removido.');
    };

    const updateDangerousRule = (id: string, updates: Partial<ShopeeDangerousTermRule>) => {
        updateDraft({
            dangerousTerms: draft.dangerousTerms.map((rule) => rule.id === id ? { ...rule, ...updates } : rule),
        });
    };

    const updateAttributeDefault = (attributeId: number, value: string | string[]) => {
        const key = String(attributeId);
        updateDraft({
            attributeDefaults: {
                ...draft.attributeDefaults,
                [key]: value,
            },
        });
    };

    const renderShopeeAttributeField = (attr: ShopeeTemplateAttributeField) => {
        const key = String(attr.attribute_id);
        const currentValue = draft.attributeDefaults[key];

        if (attr.input_kind === 'multiselect') {
            return (
                <select
                    multiple
                    value={Array.isArray(currentValue) ? currentValue : []}
                    onChange={(event) => {
                        const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                        updateAttributeDefault(attr.attribute_id, values);
                    }}
                    className="min-h-[112px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                    {attr.attribute_value_list.map((option) => (
                        <option key={`${attr.attribute_id}-${option.value_id}-${option.raw_name}`} value={option.raw_name || option.label}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }

        if (attr.input_kind === 'select') {
            return (
                <select
                    value={Array.isArray(currentValue) ? currentValue[0] || '' : currentValue || ''}
                    onChange={(event) => updateAttributeDefault(attr.attribute_id, event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                    <option value="">Selecione...</option>
                    {attr.attribute_value_list.map((option) => (
                        <option key={`${attr.attribute_id}-${option.value_id}-${option.raw_name}`} value={option.raw_name || option.label}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }

        return (
            <input
                value={Array.isArray(currentValue) ? currentValue[0] || '' : currentValue || ''}
                onChange={(event) => updateAttributeDefault(attr.attribute_id, event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder={attr.label}
            />
        );
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
                                <select
                                    value={draft.rules.categoryId || ''}
                                    onChange={(event) => updateDraft({ rules: { ...draft.rules, categoryId: event.target.value || undefined } })}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                >
                                    <option value="">Todas as categorias</option>
                                    {localCategories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
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
                        <div className="mt-5 border-t border-slate-100 pt-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800">Todos os campos da categoria</h3>
                                    <p className="text-xs text-slate-500">Preencha aqui os valores padrao que este template aplicara no envio para a Shopee.</p>
                                </div>
                                {loadingShopeeAttributes && (
                                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-orange-600">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Carregando campos
                                    </span>
                                )}
                            </div>

                            {!draft.shopeeCategoryId ? (
                                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    Informe o ID da categoria Shopee para carregar todos os campos dessa categoria.
                                </div>
                            ) : !loadingShopeeAttributes && shopeeAttributes.length === 0 ? (
                                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    Nenhum campo retornado para esta categoria ou a conexao com a Shopee nao respondeu.
                                </div>
                            ) : (
                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {shopeeAttributes.map((attr) => (
                                        <label key={attr.attribute_id} className="block">
                                            <span className="mb-1 block text-xs font-semibold text-slate-700">
                                                {attr.label}
                                                {attr.mandatory && <span className="ml-1 text-red-500">*</span>}
                                                <span className="ml-2 font-mono text-[10px] text-slate-400">#{attr.attribute_id}</span>
                                            </span>
                                            {renderShopeeAttributeField(attr)}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
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
