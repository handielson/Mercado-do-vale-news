import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Pencil, ToggleLeft, ToggleRight, Search, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
    SystemTag, SystemTagInput, TagContext, TagResolverType,
    systemTagsService, CONTEXT_LABELS, RESOLVER_LABELS
} from '../../../services/systemTagsService';

// ── Badge helpers ──────────────────────────────────────────
const CONTEXT_COLORS: Record<TagContext, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    action_sale: 'bg-green-100 text-green-700',
    action_customer: 'bg-teal-100 text-teal-700',
    welcome: 'bg-purple-100 text-purple-700',
    warranty: 'bg-orange-100 text-orange-700',
    product_name: 'bg-slate-100 text-slate-700',
    static: 'bg-pink-100 text-pink-700',
};

const RESOLVER_COLORS: Record<TagResolverType, string> = {
    static: 'bg-slate-200 text-slate-700',
    count_products: 'bg-sky-100 text-sky-700',
    sum_products_stock: 'bg-sky-100 text-sky-700',
    list_products: 'bg-indigo-100 text-indigo-700',
    count_sales_today: 'bg-emerald-100 text-emerald-700',
    sum_sales_today: 'bg-emerald-100 text-emerald-700',
    date_now: 'bg-amber-100 text-amber-700',
    system_injected: 'bg-gray-100 text-gray-500',
};

// ── Form Modal ─────────────────────────────────────────────
interface TagFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    initial?: SystemTag;
}

const EMPTY_FORM: SystemTagInput = {
    name: '',
    label: '',
    description: '',
    context: 'scheduled',
    resolver_type: 'static',
    resolver_config: {},
    preview_value: '',
    active: true,
    sort_order: 0,
};

function TagFormModal({ isOpen, onClose, onSaved, initial }: TagFormModalProps) {
    const [form, setForm] = useState<SystemTagInput>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setForm(initial
                ? { ...initial }
                : EMPTY_FORM
            );
        }
    }, [isOpen, initial]);

    const update = (key: keyof SystemTagInput, value: any) =>
        setForm(f => ({ ...f, [key]: value }));

    const updateConfig = (key: string, value: any) =>
        setForm(f => ({ ...f, resolver_config: { ...f.resolver_config, [key]: value } }));

    const handleSave = async () => {
        if (!form.label.trim()) { toast.error('Informe o nome de exibição.'); return; }
        if (!form.name.trim()) { toast.error('Informe o nome da tag.'); return; }

        try {
            setSaving(true);
            if (initial) {
                await systemTagsService.update(initial.id, form);
                toast.success('Tag atualizada!');
            } else {
                await systemTagsService.create(form);
                toast.success('Tag criada!');
            }
            onSaved();
            onClose();
        } catch (e: any) {
            toast.error(e.message?.includes('unique') ? 'Já existe uma tag com esse nome.' : 'Erro ao salvar tag.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const isReadOnly = form.resolver_type === 'system_injected';

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Tag className="w-5 h-5 text-blue-500" />
                        {initial ? 'Editar Tag' : 'Nova Tag'}
                    </h2>
                </div>

                <div className="p-6 space-y-4">
                    {/* Label */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome de exibição</label>
                        <input
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            value={form.label}
                            onChange={e => update('label', e.target.value)}
                            placeholder="Ex: Estoque de Acessórios"
                        />
                    </div>

                    {/* Name / slug */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nome da tag <span className="text-slate-400 font-normal">(será usado como <code className="bg-slate-100 px-1 rounded">{`{nome_da_tag}`}</code>)</span>
                        </label>
                        <input
                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500"
                            value={form.name}
                            onChange={e => update('name', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                            placeholder="Ex: estoque_acessorios"
                            disabled={!!initial && form.resolver_type === 'system_injected'}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição <span className="text-slate-400 font-normal">(opcional)</span></label>
                        <input
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            value={form.description || ''}
                            onChange={e => update('description', e.target.value)}
                            placeholder="Ex: Contagem de acessórios com estoque disponível"
                        />
                    </div>

                    {/* Context */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contexto de uso</label>
                        <select
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                            value={form.context}
                            onChange={e => update('context', e.target.value as TagContext)}
                        >
                            {Object.entries(CONTEXT_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Resolver Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de resolução</label>
                        <select
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                            value={form.resolver_type}
                            onChange={e => update('resolver_type', e.target.value as TagResolverType)}
                        >
                            {Object.entries(RESOLVER_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Config dinâmica por resolver_type */}
                    {form.resolver_type === 'static' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Valor fixo</label>
                            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.resolver_config.value || ''} onChange={e => updateConfig('value', e.target.value)} placeholder="Ex: Mercado do Vale" />
                        </div>
                    )}

                    {(form.resolver_type === 'count_products' || form.resolver_type === 'sum_products_stock') && (
                        <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs font-semibold text-slate-600 uppercase">Configuração do filtro</p>
                            <div>
                                <label className="block text-xs text-slate-600 mb-1">Filtro de categoria (slug)</label>
                                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.resolver_config.category_slug || ''} onChange={e => updateConfig('category_slug', e.target.value)} placeholder="Ex: celulares (deixe vazio para todos)" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 mb-1">Status do produto</label>
                                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.resolver_config.status || 'active'} onChange={e => updateConfig('status', e.target.value)}>
                                    <option value="active">Ativo</option>
                                    <option value="">Todos</option>
                                </select>
                            </div>
                            {form.resolver_type === 'count_products' && (
                                <div>
                                    <label className="block text-xs text-slate-600 mb-1">Estoque mínimo</label>
                                    <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.resolver_config.min_stock ?? 1} onChange={e => updateConfig('min_stock', Number(e.target.value))} />
                                </div>
                            )}
                        </div>
                    )}

                    {form.resolver_type === 'list_products' && (
                        <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs font-semibold text-slate-600 uppercase">Configuração da lista</p>
                            <div>
                                <label className="block text-xs text-slate-600 mb-1">Filtro de categoria (slug)</label>
                                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.resolver_config.category_slug || ''} onChange={e => updateConfig('category_slug', e.target.value)} placeholder="Ex: celulares" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 mb-1">Formato da linha</label>
                                <input className="w-full border rounded-lg px-3 py-2 text-sm font-mono" value={form.resolver_config.format || '• {qty}x - {name} - {color} - {ram}/{storage}'} onChange={e => updateConfig('format', e.target.value)} />
                                <p className="text-[11px] text-slate-400 mt-1">Variáveis: {'{qty}'} {'{name}'} {'{color}'} {'{ram}'} {'{storage}'} {'{avg_price}'} {'{price_pix}'} {'{price_card}'}</p>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 mb-1">Limite de itens</label>
                                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.resolver_config.limit ?? 30} onChange={e => updateConfig('limit', Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 mb-1">Ordenar por</label>
                                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.resolver_config.order_by || 'stock_desc'} onChange={e => updateConfig('order_by', e.target.value)}>
                                    <option value="stock_desc">Maior estoque primeiro</option>
                                    <option value="stock_asc">Menor estoque primeiro</option>
                                    <option value="name_asc">Nome A-Z</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {(form.resolver_type === 'count_sales_today' || form.resolver_type === 'sum_sales_today') && (
                        <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs font-semibold text-slate-600 uppercase">Configuração</p>
                            {form.resolver_type === 'sum_sales_today' && (
                                <div>
                                    <label className="block text-xs text-slate-600 mb-1">Campo a somar</label>
                                    <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.resolver_config.field || 'total'} onChange={e => updateConfig('field', e.target.value)}>
                                        <option value="total">Total faturado</option>
                                        <option value="profit">Lucro</option>
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs text-slate-600 mb-1">Status da venda</label>
                                <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.resolver_config.status || 'completed'} onChange={e => updateConfig('status', e.target.value)}>
                                    <option value="completed">Concluída</option>
                                    <option value="">Todos os status</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {form.resolver_type === 'date_now' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Formato</label>
                            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white" value={form.resolver_config.format || 'date'} onChange={e => updateConfig('format', e.target.value)}>
                                <option value="date">Data (DD/MM/YYYY)</option>
                                <option value="time">Hora (HH:mm)</option>
                                <option value="datetime">Data e Hora</option>
                            </select>
                        </div>
                    )}

                    {isReadOnly && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                            🔒 Esta é uma tag injetada pelo sistema. O valor é definido automaticamente pelo código no momento de uso e não pode ser configurado aqui.
                        </div>
                    )}

                    {/* Preview value */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Valor de preview <span className="text-slate-400 font-normal">(para simular nos templates)</span></label>
                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.preview_value} onChange={e => update('preview_value', e.target.value)} placeholder="Ex: 42" />
                    </div>
                </div>

                <div className="p-6 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-slate-50 transition">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                        {saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar Tag'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────
export default function SystemTagsPage() {
    const [tags, setTags] = useState<SystemTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterContext, setFilterContext] = useState<TagContext | ''>('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<SystemTag | undefined>();

    const load = async () => {
        try {
            setLoading(true);
            const data = await systemTagsService.list();
            setTags(data);
        } catch {
            toast.error('Erro ao carregar tags.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (tag: SystemTag) => {
        if (tag.resolver_type === 'system_injected') {
            toast.error('Tags do sistema não podem ser excluídas.');
            return;
        }
        if (!confirm(`Excluir a tag {${tag.name}}? Isso pode quebrar templates que a usam.`)) return;
        try {
            await systemTagsService.delete(tag.id);
            toast.success('Tag removida.');
            load();
        } catch {
            toast.error('Erro ao remover tag.');
        }
    };

    const handleToggle = async (tag: SystemTag) => {
        try {
            await systemTagsService.toggleActive(tag.id, !tag.active);
            load();
        } catch {
            toast.error('Erro ao alterar status.');
        }
    };

    const filtered = tags.filter(t => {
        const matchSearch = !search || t.name.includes(search.toLowerCase()) || t.label.toLowerCase().includes(search.toLowerCase());
        const matchContext = !filterContext || t.context === filterContext;
        return matchSearch && matchContext;
    });

    // Group by context
    const grouped = filtered.reduce<Record<string, SystemTag[]>>((acc, t) => {
        if (!acc[t.context]) acc[t.context] = [];
        acc[t.context].push(t);
        return acc;
    }, {});

    return (
        <div className="animate-in fade-in duration-300 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Tag className="w-8 h-8 text-blue-500" />
                        Tags do Sistema
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Variáveis dinâmicas reutilizáveis em Telegram, WhatsApp, relatórios e documentos.
                    </p>
                </div>
                <button
                    onClick={() => { setEditing(undefined); setModalOpen(true); }}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-blue-700 transition shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nova Tag
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="Buscar tag..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <select
                        className="border rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                        value={filterContext}
                        onChange={e => setFilterContext(e.target.value as TagContext | '')}
                    >
                        <option value="">Todos os contextos</option>
                        {Object.entries(CONTEXT_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{tags.length}</p>
                    <p className="text-xs text-slate-500 mt-1">Tags totais</p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{tags.filter(t => t.active).length}</p>
                    <p className="text-xs text-slate-500 mt-1">Tags ativas</p>
                </div>
                <div className="bg-white border rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">{tags.filter(t => t.resolver_type !== 'system_injected').length}</p>
                    <p className="text-xs text-slate-500 mt-1">Computáveis</p>
                </div>
            </div>

            {/* Tag List by Group */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : Object.keys(grouped).length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma tag encontrada.</p>
                </div>
            ) : (
                Object.entries(grouped).map(([ctx, ctxTags]) => (
                    <div key={ctx} className="bg-white border rounded-xl overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50 border-b flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CONTEXT_COLORS[ctx as TagContext]}`}>
                                {CONTEXT_LABELS[ctx as TagContext]}
                            </span>
                            <span className="text-xs text-slate-400">{ctxTags.length} tag{ctxTags.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="divide-y">
                            {ctxTags.map(tag => (
                                <div key={tag.id} className={`flex items-center gap-3 px-5 py-3 ${!tag.active ? 'opacity-50' : ''}`}>
                                    {/* Tag name */}
                                    <code className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded w-48 flex-shrink-0 truncate">
                                        {`{${tag.name}}`}
                                    </code>

                                    {/* Label + desc */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800">{tag.label}</p>
                                        {tag.description && <p className="text-xs text-slate-400 truncate">{tag.description}</p>}
                                    </div>

                                    {/* Resolver badge */}
                                    <span className={`hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${RESOLVER_COLORS[tag.resolver_type]}`}>
                                        {RESOLVER_LABELS[tag.resolver_type].split(' ').slice(0, 2).join(' ')}
                                    </span>

                                    {/* Preview */}
                                    {tag.preview_value && (
                                        <span className="hidden md:inline text-xs text-slate-400 max-w-[120px] truncate">
                                            → {tag.preview_value}
                                        </span>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => handleToggle(tag)}
                                            className="p-1.5 rounded hover:bg-slate-100 transition text-slate-400"
                                            title={tag.active ? 'Desativar' : 'Ativar'}
                                        >
                                            {tag.active
                                                ? <ToggleRight className="w-4 h-4 text-green-500" />
                                                : <ToggleLeft className="w-4 h-4" />
                                            }
                                        </button>
                                        <button
                                            onClick={() => { setEditing(tag); setModalOpen(true); }}
                                            className="p-1.5 rounded hover:bg-slate-100 transition text-slate-400 hover:text-blue-600"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tag)}
                                            disabled={tag.resolver_type === 'system_injected'}
                                            className="p-1.5 rounded hover:bg-red-50 transition text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            <TagFormModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSaved={load}
                initial={editing}
            />
        </div>
    );
}
