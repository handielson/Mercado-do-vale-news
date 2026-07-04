import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    Copy,
    ExternalLink,
    KeyRound,
    Loader2,
    MonitorSmartphone,
    Plus,
    RefreshCw,
    Save,
    Trash2,
    Unlink,
    Wifi,
} from 'lucide-react';
import { toast } from 'sonner';
import { pdvDisplayService } from '../../../services/pdvDisplayService';
import { productService } from '../../../services/products';
import { categoryService } from '../../../services/categories';
import type { PdvDisplay, PdvDisplayIdleContent, PdvDisplayInput, PdvDisplaySettings, PdvDisplayType, PdvDisplayOrientation } from '../../../types/pdvDisplay';
import type { Product } from '../../../types/product';
import type { Category } from '../../../types/category';

const DEFAULT_SETTINGS: PdvDisplaySettings = {
    showStoreName: true,
    showPixAmount: true,
    showItems: true,
    showInstructions: true,
    showAdsDuringPix: false,
    adRotationSeconds: 8,
};

const DEFAULT_FORM: PdvDisplayInput = {
    name: '',
    slug: '',
    type: 'cashier',
    orientation: 'landscape',
    cashier_key: '',
    is_active: true,
    settings: DEFAULT_SETTINGS,
    idle_content: { banners: [], products: [], categories: [], messages: ['Obrigado pela preferencia.'] },
};

const DEFAULT_IDLE_CONTENT: PdvDisplayIdleContent = {
    banners: [],
    products: [],
    categories: [],
    messages: ['Obrigado pela preferencia.'],
};

function displayTypeLabel(type: PdvDisplayType): string {
    if (type === 'cashier') return 'Caixa';
    if (type === 'ads') return 'Propaganda';
    return 'Hibrido';
}

function normalizeDisplaySettings(display?: PdvDisplay | null): PdvDisplaySettings {
    return {
        ...DEFAULT_SETTINGS,
        ...(display?.settings || {}),
    };
}

function normalizeForm(display?: PdvDisplay | null): PdvDisplayInput {
    if (!display) return { ...DEFAULT_FORM, settings: { ...DEFAULT_SETTINGS } };
    return {
        name: display.name || '',
        slug: display.slug || '',
        type: display.type,
        orientation: display.orientation,
        cashier_key: display.cashier_key || '',
        is_active: display.is_active,
        settings: normalizeDisplaySettings(display),
        idle_content: {
            ...DEFAULT_IDLE_CONTENT,
            ...(display.idle_content || {}),
        },
    };
}

export default function DisplaysPage() {
    const [displays, setDisplays] = useState<PdvDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editingDisplay, setEditingDisplay] = useState<PdvDisplay | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<PdvDisplayInput>(DEFAULT_FORM);
    const [pairingCode, setPairingCode] = useState<{ displayId: string; code: string; expiresMinutes: number } | null>(null);
    const [idleProductSearch, setIdleProductSearch] = useState<Record<number, string>>({});
    const [idleProductResults, setIdleProductResults] = useState<Record<number, Product[]>>({});
    const [idleCategories, setIdleCategories] = useState<Category[]>([]);

    useEffect(() => {
        loadDisplays();
        loadIdleCategories();
    }, []);

    const summary = useMemo(() => {
        const active = displays.filter((display) => display.is_active).length;
        const paired = displays.filter((display) => Boolean(display.paired_at)).length;
        const cashier = displays.filter((display) => display.type === 'cashier' || display.type === 'hybrid').length;
        return { total: displays.length, active, paired, cashier };
    }, [displays]);

    async function loadDisplays() {
        try {
            setLoading(true);
            setError(null);
            setDisplays(await pdvDisplayService.listDisplays());
        } catch (err: any) {
            setError(err?.message || 'Erro ao carregar displays');
        } finally {
            setLoading(false);
        }
    }

    async function loadIdleCategories() {
        try {
            setIdleCategories(await categoryService.list(true));
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao carregar categorias para propaganda');
        }
    }

    function openCreateForm() {
        setEditingDisplay(null);
        setFormData({ ...DEFAULT_FORM, settings: { ...DEFAULT_SETTINGS } });
        setIdleProductSearch({});
        setIdleProductResults({});
        setShowForm(true);
    }

    function openEditForm(display: PdvDisplay) {
        setEditingDisplay(display);
        setFormData(normalizeForm(display));
        setIdleProductSearch({});
        setIdleProductResults({});
        setShowForm(true);
    }

    function updateSetting<K extends keyof PdvDisplaySettings>(key: K, value: PdvDisplaySettings[K]) {
        setFormData((current) => ({
            ...current,
            settings: {
                ...DEFAULT_SETTINGS,
                ...(current.settings || {}),
                [key]: value,
            },
        }));
    }

    function updateIdleContent(nextIdleContent: Partial<PdvDisplayIdleContent>) {
        setFormData((current) => ({
            ...current,
            idle_content: {
                ...DEFAULT_IDLE_CONTENT,
                ...(current.idle_content || {}),
                ...nextIdleContent,
            },
        }));
    }

    function addIdleMessage() {
        const messages = [...(formData.idle_content?.messages || []), 'Nova mensagem'];
        updateIdleContent({ messages });
    }

    function removeIdleMessage(index: number) {
        const messages = (formData.idle_content?.messages || []).filter((_, itemIndex) => itemIndex !== index);
        updateIdleContent({ messages });
    }

    function updateIdleMessage(index: number, message: string) {
        const messages = [...(formData.idle_content?.messages || [])];
        messages[index] = message;
        updateIdleContent({ messages });
    }

    function addIdleBanner() {
        const banners = [...(formData.idle_content?.banners || []), { title: '', image_url: '', link_url: '' }];
        updateIdleContent({ banners });
    }

    function removeIdleBanner(index: number) {
        const banners = (formData.idle_content?.banners || []).filter((_, itemIndex) => itemIndex !== index);
        updateIdleContent({ banners });
    }

    function updateIdleBanner(index: number, field: 'title' | 'image_url' | 'link_url', value: string) {
        const banners = [...(formData.idle_content?.banners || [])];
        banners[index] = { ...(banners[index] || {}), [field]: value };
        updateIdleContent({ banners });
    }

    function addIdleProduct() {
        const products = [...(formData.idle_content?.products || []), { name: '', price: 0, image_url: '', category_name: '' }];
        updateIdleContent({ products });
    }

    function removeIdleProduct(index: number) {
        const products = (formData.idle_content?.products || []).filter((_, itemIndex) => itemIndex !== index);
        updateIdleContent({ products });
    }

    function updateIdleProduct(index: number, field: 'name' | 'price' | 'image_url' | 'category_name', value: string) {
        const products = [...(formData.idle_content?.products || [])];
        products[index] = {
            ...(products[index] || { name: '' }),
            [field]: field === 'price' ? Math.max(0, Math.round(Number(value.replace(',', '.')) * 100) || 0) : value,
        };
        updateIdleContent({ products });
    }

    function getProductCategoryName(product: Product): string {
        return String((product as any).category_name || (product as any).category || (product as any).category_slug || '').trim();
    }

    async function searchIdleProducts(index: number, query: string) {
        const term = query.trim();
        setIdleProductSearch((current) => ({ ...current, [index]: query }));
        if (term.length < 2) {
            setIdleProductResults((current) => ({ ...current, [index]: [] }));
            return;
        }

        try {
            const byText = await productService.search(term);
            const byEan = /^\d{8,}$/.test(term) ? await productService.searchByEAN(term) : [];
            const byId = new Map<string, Product>();
            [...byEan, ...byText].forEach((product) => byId.set(product.id, product));
            setIdleProductResults((current) => ({ ...current, [index]: Array.from(byId.values()).slice(0, 8) }));
        } catch (error: any) {
            toast.error(error?.message || 'Erro ao buscar produto para propaganda');
        }
    }

    function handleSelectIdleProduct(index: number, productId: string) {
        const product = (idleProductResults[index] || []).find((item) => item.id === productId);
        if (!product) return;
        const products = [...(formData.idle_content?.products || [])];
        products[index] = {
            product_id: product.id,
            name: product.name,
            sku: product.sku,
            category_name: getProductCategoryName(product),
            price: Number(product.price_retail || 0),
            image_url: product.images?.[0] || '',
        };
        updateIdleContent({ products });
        setIdleProductSearch((current) => ({ ...current, [index]: `${product.sku || ''} ${product.name}`.trim() }));
        setIdleProductResults((current) => ({ ...current, [index]: [] }));
    }

    function addIdleCategory() {
        const categories = [...(formData.idle_content?.categories || []), { category_id: '', category_name: '' }];
        updateIdleContent({ categories });
    }

    function removeIdleCategory(index: number) {
        const categories = (formData.idle_content?.categories || []).filter((_, itemIndex) => itemIndex !== index);
        updateIdleContent({ categories });
    }

    function updateIdleCategory(index: number, categoryId: string) {
        const category = idleCategories.find((item) => item.id === categoryId);
        const categories = [...(formData.idle_content?.categories || [])];
        categories[index] = {
            ...(categories[index] || {}),
            category_id: categoryId,
            category_name: category?.name || '',
        };
        updateIdleContent({ categories });
    }

    async function handleSave(event: React.FormEvent) {
        event.preventDefault();
        const name = String(formData.name || '').trim();
        if (!name) {
            toast.error('Informe o nome do display.');
            return;
        }

        const payload: PdvDisplayInput = {
            ...formData,
            name,
            slug: formData.slug?.trim() || undefined,
            cashier_key: formData.cashier_key?.trim() || null,
            settings: {
                ...DEFAULT_SETTINGS,
                ...(formData.settings || {}),
                adRotationSeconds: Math.max(3, Number(formData.settings?.adRotationSeconds || DEFAULT_SETTINGS.adRotationSeconds)),
            },
            idle_content: {
                banners: (formData.idle_content?.banners || []).filter((banner) => banner.image_url || banner.title),
                products: (formData.idle_content?.products || []).filter((product) => product.name),
                categories: (formData.idle_content?.categories || []).filter((category) => category.category_id),
                messages: (formData.idle_content?.messages || []).map((message) => String(message || '').trim()).filter(Boolean),
            },
        };

        try {
            setSaving(true);
            if (editingDisplay) {
                await pdvDisplayService.updateDisplay(editingDisplay.id, payload);
                toast.success('Display atualizado.');
            } else {
                await pdvDisplayService.createDisplay(payload);
                toast.success('Display criado.');
            }
            setShowForm(false);
            setEditingDisplay(null);
            await loadDisplays();
        } catch (err: any) {
            const message = String(err?.message || '');
            toast.error(message.includes('Ja existe um display')
                ? 'Ja existe um display com este nome. Use outro nome para nao duplicar.'
                : message || 'Erro ao salvar display');
        } finally {
            setSaving(false);
        }
    }

    async function handleGeneratePairingCode(display: PdvDisplay) {
        try {
            setBusyId(display.id);
            const result = await pdvDisplayService.generatePairingCode(display.id);
            setPairingCode({ displayId: display.id, code: result.code, expiresMinutes: result.expires_minutes });
            toast.success('Codigo de pareamento gerado.');
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao gerar codigo');
        } finally {
            setBusyId(null);
        }
    }

    async function handleCopyCode(code: string) {
        try {
            await navigator.clipboard.writeText(code);
            toast.success('Codigo copiado.');
        } catch {
            toast.message(`Codigo: ${code}`);
        }
    }

    async function handleRevoke(display: PdvDisplay) {
        if (!window.confirm(`Revogar pareamento de "${display.name}"? O Android precisara parear de novo.`)) return;
        try {
            setBusyId(display.id);
            await pdvDisplayService.revokeDisplayToken(display.id);
            toast.success('Pareamento revogado.');
            await loadDisplays();
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao revogar pareamento');
        } finally {
            setBusyId(null);
        }
    }

    async function handleDelete(display: PdvDisplay) {
        if (!window.confirm(`Excluir o display "${display.name}"? Essa acao nao remove Pix aprovado.`)) return;
        try {
            setBusyId(display.id);
            await pdvDisplayService.deleteDisplay(display.id);
            toast.success('Display excluido.');
            await loadDisplays();
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao excluir display');
        } finally {
            setBusyId(null);
        }
    }

    async function handleCleanupTrash() {
        if (!window.confirm('Limpar codigos expirados, tokens revogados antigos e Pix de teste pendente/cancelado?')) return;
        try {
            setBusyId('cleanup');
            const result = await pdvDisplayService.cleanupTrash();
            const deleted = result.deleted || {};
            toast.success(`Limpeza concluida: ${Object.values(deleted).reduce((sum, value) => sum + Number(value || 0), 0)} itens removidos.`);
            await loadDisplays();
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao limpar lixo');
        } finally {
            setBusyId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-100 p-3 text-blue-700">
                        <MonitorSmartphone className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Displays Android</h1>
                        <p className="text-sm text-slate-500">Tablets de caixa, TVs de propaganda e telas hibridas pareadas por codigo.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href="/display"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Abrir tela de pareamento
                    </a>
                    <button
                        type="button"
                        onClick={handleCleanupTrash}
                        disabled={busyId === 'cleanup'}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                        {busyId === 'cleanup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Excluir lixo
                    </button>
                    <button
                        type="button"
                        onClick={openCreateForm}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Novo display
                    </button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                {[
                    ['Total', summary.total],
                    ['Ativos', summary.active],
                    ['Pareados', summary.paired],
                    ['Recebem Pix', summary.cashier],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                    </div>
                ))}
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">Nao foi possivel carregar os displays.</p>
                        <p>{error}</p>
                        <button type="button" onClick={loadDisplays} className="mt-2 font-semibold underline">
                            Tentar novamente
                        </button>
                    </div>
                </div>
            )}

            {displays.length === 0 && !error ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                    <MonitorSmartphone className="mx-auto h-10 w-10 text-slate-400" />
                    <h2 className="mt-3 text-lg font-semibold text-slate-900">Nenhum display cadastrado</h2>
                    <p className="mt-1 text-sm text-slate-500">Crie a tela do caixa ou da TV e gere um codigo para parear no Android.</p>
                    <button
                        type="button"
                        onClick={openCreateForm}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Criar primeiro display
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {displays.map((display) => {
                        const settings = normalizeDisplaySettings(display);
                        const isBusy = busyId === display.id;
                        const codeForDisplay = pairingCode?.displayId === display.id ? pairingCode : null;
                        return (
                            <article key={display.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate text-lg font-bold text-slate-900">{display.name}</h2>
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                                {displayTypeLabel(display.type)}
                                            </span>
                                            <span className={display.is_active ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500'}>
                                                {display.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {display.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}
                                            {display.cashier_key ? ` - Caixa: ${display.cashier_key}` : ' - Sem caixa vinculado'}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">Slug: {display.slug}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => openEditForm(display)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                            Editar
                                        </button>
                                        <button type="button" onClick={() => handleGeneratePairingCode(display)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                                            Parear
                                        </button>
                                        <button type="button" onClick={() => handleRevoke(display)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60">
                                            <Unlink className="h-3.5 w-3.5" />
                                            Revogar
                                        </button>
                                        <button type="button" onClick={() => handleDelete(display)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60">
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Excluir
                                        </button>
                                    </div>
                                </div>

                                {codeForDisplay && (
                                    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Codigo de pareamento</p>
                                            <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-blue-950">{codeForDisplay.code}</p>
                                            <p className="text-xs text-blue-700">Expira em {codeForDisplay.expiresMinutes} minutos.</p>
                                        </div>
                                        <button type="button" onClick={() => handleCopyCode(codeForDisplay.code)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                                            <Copy className="h-4 w-4" />
                                            Copiar
                                        </button>
                                    </div>
                                )}

                                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                    <DisplayFlag active={settings.showStoreName} label="Loja" />
                                    <DisplayFlag active={settings.showPixAmount} label="Valor Pix" />
                                    <DisplayFlag active={settings.showItems} label="Itens" />
                                    <DisplayFlag active={settings.showInstructions} label="Instrucoes" />
                                    <DisplayFlag active={settings.showAdsDuringPix} label="Propaganda no Pix" />
                                    <DisplayFlag active={Boolean(display.paired_at)} label={display.paired_at ? 'Pareado' : 'Nao pareado'} />
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
                    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
                        <form onSubmit={handleSave} className="space-y-6 p-6">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">{editingDisplay ? 'Editar display' : 'Novo display'}</h2>
                                    <p className="text-sm text-slate-500">Configure o Android que vai exibir Pix, propaganda ou os dois.</p>
                                </div>
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
                                    Fechar
                                </button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Nome</span>
                                    <input
                                        value={formData.name}
                                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                                        placeholder="Caixa 01 - Tablet Pix"
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Slug publico</span>
                                    <input
                                        value={formData.slug || ''}
                                        onChange={(event) => setFormData({ ...formData, slug: event.target.value })}
                                        placeholder="caixa-01-tablet"
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Tipo</span>
                                    <select
                                        value={formData.type}
                                        onChange={(event) => setFormData({ ...formData, type: event.target.value as PdvDisplayType })}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="cashier">Caixa</option>
                                        <option value="ads">Propaganda</option>
                                        <option value="hybrid">Hibrido</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Orientacao</span>
                                    <select
                                        value={formData.orientation}
                                        onChange={(event) => setFormData({ ...formData, orientation: event.target.value as PdvDisplayOrientation })}
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="landscape">Horizontal</option>
                                        <option value="portrait">Vertical</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-sm font-semibold text-slate-700">Caixa vinculado</span>
                                    <input
                                        value={formData.cashier_key || ''}
                                        onChange={(event) => setFormData({ ...formData, cashier_key: event.target.value })}
                                        placeholder="caixa-01"
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                                <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active !== false}
                                        onChange={(event) => setFormData({ ...formData, is_active: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="text-sm font-semibold text-slate-700">Display ativo</span>
                                </label>
                            </div>

                            <div>
                                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Exibicao durante Pix</h3>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <ToggleRow label="Mostrar nome da loja" checked={Boolean(formData.settings?.showStoreName)} onChange={(value) => updateSetting('showStoreName', value)} />
                                    <ToggleRow label="Mostrar valor do Pix" checked={Boolean(formData.settings?.showPixAmount)} onChange={(value) => updateSetting('showPixAmount', value)} />
                                    <ToggleRow label="Mostrar resumo de itens" checked={Boolean(formData.settings?.showItems)} onChange={(value) => updateSetting('showItems', value)} />
                                    <ToggleRow label="Mostrar instrucoes" checked={Boolean(formData.settings?.showInstructions)} onChange={(value) => updateSetting('showInstructions', value)} />
                                    <ToggleRow label="Mostrar propaganda durante Pix" checked={Boolean(formData.settings?.showAdsDuringPix)} onChange={(value) => updateSetting('showAdsDuringPix', value)} />
                                    <label className="block rounded-lg border border-slate-200 px-3 py-2">
                                        <span className="text-sm font-semibold text-slate-700">Troca das propagandas (s)</span>
                                        <input
                                            type="number"
                                            min={3}
                                            value={formData.settings?.adRotationSeconds || DEFAULT_SETTINGS.adRotationSeconds}
                                            onChange={(event) => updateSetting('adRotationSeconds', Number(event.target.value))}
                                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Conteudo ocioso</h3>
                                    <p className="mt-1 text-sm text-slate-500">Mensagens, banners e produtos exibidos quando nao houver Pix ativo.</p>
                                </div>

                                <section className="rounded-lg border border-slate-200 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="text-sm font-bold text-slate-800">Mensagens</h4>
                                        <button type="button" onClick={addIdleMessage} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                            Adicionar mensagem
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {(formData.idle_content?.messages || []).map((message, index) => (
                                            <div key={`message-${index}`} className="flex gap-2">
                                                <input
                                                    value={message}
                                                    onChange={(event) => updateIdleMessage(index, event.target.value)}
                                                    placeholder="Mensagem para a segunda tela"
                                                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button type="button" onClick={() => removeIdleMessage(index)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-lg border border-slate-200 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="text-sm font-bold text-slate-800">Banners</h4>
                                        <button type="button" onClick={addIdleBanner} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                            Adicionar banner
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(formData.idle_content?.banners || []).map((banner, index) => (
                                            <div key={`banner-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto]">
                                                <input
                                                    value={banner.title || ''}
                                                    onChange={(event) => updateIdleBanner(index, 'title', event.target.value)}
                                                    placeholder="Titulo do banner"
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <input
                                                    value={banner.image_url || ''}
                                                    onChange={(event) => updateIdleBanner(index, 'image_url', event.target.value)}
                                                    placeholder="Imagem URL"
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button type="button" onClick={() => removeIdleBanner(index)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-lg border border-slate-200 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="text-sm font-bold text-slate-800">Produtos em destaque</h4>
                                        <button type="button" onClick={addIdleProduct} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                            Adicionar produto
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(formData.idle_content?.products || []).map((product, index) => (
                                            <div key={`product-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_130px_1fr_auto]">
                                                <div className="space-y-2">
                                                    <input
                                                        value={idleProductSearch[index] ?? product.sku ?? product.name ?? ''}
                                                        onChange={(event) => searchIdleProducts(index, event.target.value)}
                                                        placeholder="SKU, nome ou EAN"
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    {(idleProductResults[index] || []).length > 0 && (
                                                        <select
                                                            value=""
                                                            onChange={(event) => handleSelectIdleProduct(index, event.target.value)}
                                                            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="">Selecionar produto encontrado</option>
                                                            {(idleProductResults[index] || []).map((item) => (
                                                                <option key={item.id} value={item.id}>
                                                                    {item.sku ? `${item.sku} - ` : ''}{item.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    )}
                                                    {product.name && (
                                                        <p className="text-xs font-semibold text-slate-600">
                                                            Selecionado: {product.name}
                                                            {product.category_name ? ` - ${product.category_name}` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                                <input
                                                    value={product.price ? (Number(product.price) / 100).toFixed(2).replace('.', ',') : ''}
                                                    onChange={(event) => updateIdleProduct(index, 'price', event.target.value)}
                                                    placeholder="Valor"
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <input
                                                    value={product.image_url || ''}
                                                    onChange={(event) => updateIdleProduct(index, 'image_url', event.target.value)}
                                                    placeholder="Imagem URL"
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <button type="button" onClick={() => removeIdleProduct(index)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-lg border border-slate-200 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="text-sm font-bold text-slate-800">Produtos por categoria</h4>
                                        <button type="button" onClick={addIdleCategory} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                                            Adicionar categoria
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(formData.idle_content?.categories || []).map((category, index) => (
                                            <div key={`idle-category-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_auto]">
                                                <select
                                                    value={category.category_id || ''}
                                                    onChange={(event) => updateIdleCategory(index, event.target.value)}
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">Selecionar categoria</option>
                                                    {idleCategories.map((item) => (
                                                        <option key={item.id} value={item.id}>{item.name}</option>
                                                    ))}
                                                </select>
                                                <button type="button" onClick={() => removeIdleCategory(index)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function DisplayFlag({ active, label }: { active: boolean; label: string }) {
    return (
        <span className={active ? 'inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 font-semibold text-green-700' : 'inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-500'}>
            <Wifi className="h-4 w-4" />
            {label}
        </span>
    );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
        </label>
    );
}
