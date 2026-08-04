import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Copy, ExternalLink, Facebook, Image, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CatalogProduct } from '../../../../types/catalog';
import { catalogService } from '../../../../services/catalogService';
import {
    facebookMarketplaceScheduleService,
    type FacebookMarketplaceDestination,
    type FacebookMarketplaceSchedule,
    type FacebookMarketplaceStatus,
} from '../../../../services/facebookMarketplaceScheduleService';
import FacebookMarketplaceCampaignPanel from './FacebookMarketplaceCampaignPanel';
import { facebookMarketplaceCampaignService, type FacebookMarketplaceGroup } from '../../../../services/facebookMarketplaceCampaignService';

const MARKETPLACE_CREATE_URL = 'https://www.facebook.com/marketplace/create/item';

interface Props {
    initialProduct?: CatalogProduct | null;
    initialDescription?: string;
}

const toLocalInputValue = (date = new Date(Date.now() + 60 * 60 * 1000)) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
};

const toMysqlDateTime = (value: string) => value ? `${value.replace('T', ' ')}:00` : '';

const formatMoney = (cents: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
}).format((Number(cents) || 0) / 100);

const formatDateTime = (value: string) => {
    const normalized = String(value || '').replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
};

const stripHtml = (value?: string) => String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const parseDestinations = (value: string): FacebookMarketplaceDestination[] => {
    const groups = value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const separator = line.indexOf('|');
        const name = (separator >= 0 ? line.slice(0, separator) : line).trim();
        const url = (separator >= 0 ? line.slice(separator + 1) : '').trim();
        return { name, url: url || undefined, type: 'group' as const };
    });
    return [{ name: 'Facebook Marketplace', type: 'marketplace' }, ...groups];
};

const statusLabel: Record<FacebookMarketplaceStatus, string> = {
    scheduled: 'Agendado',
    ready: 'Pronto para publicar',
    published: 'Publicado',
    cancelled: 'Cancelado',
};

const effectiveStatus = (item: FacebookMarketplaceSchedule): FacebookMarketplaceStatus => {
    if (item.status !== 'scheduled') return item.status;
    const due = new Date(String(item.scheduled_for).replace(' ', 'T')).getTime();
    return Number.isFinite(due) && due <= Date.now() ? 'ready' : 'scheduled';
};

export default function FacebookMarketplaceSchedulerPanel({ initialProduct, initialDescription }: Props) {
    const [items, setItems] = useState<FacebookMarketplaceSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [product, setProduct] = useState<CatalogProduct | null>(initialProduct ?? null);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<CatalogProduct[]>([]);
    const [scheduledFor, setScheduledFor] = useState(toLocalInputValue());
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [groupLines, setGroupLines] = useState('');
    const [savedGroups, setSavedGroups] = useState<FacebookMarketplaceGroup[]>([]);
    const [selectedGroupUrls, setSelectedGroupUrls] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            setItems(await facebookMarketplaceScheduleService.list());
        } catch (error) {
            console.error(error);
            toast.error('Não foi possível carregar a fila do Facebook Marketplace.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        facebookMarketplaceCampaignService.listGroups().then(setSavedGroups).catch(() => setSavedGroups([]));
    }, []);

    useEffect(() => {
        if (!initialProduct || showForm) return;
        setProduct(initialProduct);
    }, [initialProduct, showForm]);

    const fillFromProduct = (next: CatalogProduct | null, preferredDescription?: string) => {
        setProduct(next);
        if (!next) return;
        const cents = next.price_promo || next.price_retail || 0;
        setPrice((cents / 100).toFixed(2).replace('.', ','));
        setDescription(preferredDescription?.trim() || [
            next.name,
            stripHtml(next.description),
            `Preço: ${formatMoney(cents)}`,
            'Chame no WhatsApp para confirmar disponibilidade.',
        ].filter(Boolean).join('\n\n'));
        setResults([]);
        setSearch('');
    };

    const openNew = () => {
        setScheduledFor(toLocalInputValue());
        setGroupLines(localStorage.getItem('facebook_marketplace_groups') || '');
        setSelectedGroupUrls([]);
        setNotes('');
        fillFromProduct(initialProduct ?? null, initialDescription);
        setShowForm(true);
    };

    const runSearch = async () => {
        if (search.trim().length < 2) return;
        setSearching(true);
        try {
            const response = await catalogService.getProducts({ search: search.trim(), inStockOnly: true }, 1, 12, true);
            setResults(response.products);
        } catch {
            toast.error('Erro ao buscar produtos.');
        } finally {
            setSearching(false);
        }
    };

    const save = async () => {
        if (!product) return toast.error('Selecione um produto.');
        if (!scheduledFor) return toast.error('Informe a data e o horário.');
        if (!description.trim()) return toast.error('Informe a descrição do anúncio.');
        const priceCents = Math.round(Number(price.replace(/\./g, '').replace(',', '.')) * 100);
        if (!Number.isFinite(priceCents) || priceCents <= 0) return toast.error('Informe um preço válido.');

        setSaving(true);
        try {
            const savedDestinations = savedGroups
                .filter((group) => selectedGroupUrls.includes(group.url))
                .map((group) => ({ name: group.name, url: group.url, type: 'group' as const }));
            const destinations = [...parseDestinations(groupLines), ...savedDestinations]
                .filter((destination, index, list) => list.findIndex((item) => item.type === destination.type && item.url === destination.url) === index);
            localStorage.setItem('facebook_marketplace_groups', groupLines);
            const created = await facebookMarketplaceScheduleService.create({
                product_id: product.id,
                product_name: product.name,
                price_cents: priceCents,
                description: description.trim(),
                image_urls: Array.isArray(product.images) ? product.images.filter(Boolean).slice(0, 10) : [],
                destinations,
                scheduled_for: toMysqlDateTime(scheduledFor),
                status: 'scheduled',
                notes: notes.trim() || null,
                published_url: null,
            });
            setItems((current) => [...current, created].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for)));
            setShowForm(false);
            toast.success('Publicação programada.');
        } catch (error) {
            console.error(error);
            toast.error('Erro ao programar publicação.');
        } finally {
            setSaving(false);
        }
    };

    const preparePost = async (item: FacebookMarketplaceSchedule) => {
        await navigator.clipboard.writeText(item.description);
        window.open(MARKETPLACE_CREATE_URL, '_blank', 'noopener,noreferrer');
        toast.success('Descrição copiada e formulário do Marketplace aberto.');
    };

    const markPublished = async (item: FacebookMarketplaceSchedule) => {
        try {
            const updated = await facebookMarketplaceScheduleService.update(item.id, {
                status: 'published',
                published_at: new Date().toISOString(),
            });
            setItems((current) => current.map((row) => row.id === item.id ? updated : row));
            toast.success('Publicação marcada como concluída.');
        } catch {
            toast.error('Erro ao atualizar publicação.');
        }
    };

    const remove = async (item: FacebookMarketplaceSchedule) => {
        if (!window.confirm(`Excluir a programação de “${item.product_name}”?`)) return;
        try {
            await facebookMarketplaceScheduleService.delete(item.id);
            setItems((current) => current.filter((row) => row.id !== item.id));
            toast.success('Programação excluída.');
        } catch {
            toast.error('Erro ao excluir programação.');
        }
    };

    const pendingCount = useMemo(() => items.filter((item) => ['scheduled', 'ready'].includes(effectiveStatus(item))).length, [items]);

    return (
        <section className="rounded-2xl border border-blue-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-blue-50 p-2.5"><Facebook className="h-5 w-5 text-blue-600" /></div>
                    <div>
                        <h2 className="font-black text-slate-900">Programador Facebook Marketplace</h2>
                        <p className="mt-1 text-sm text-slate-500">Fila assistida para Marketplace e grupos de venda · {pendingCount} pendente(s)</p>
                    </div>
                </div>
                <button onClick={openNew} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                    <Plus className="h-4 w-4" /> Programar anúncio
                </button>
            </div>

            <div className="border-b border-blue-100 bg-blue-50/60 px-5 py-3 text-xs leading-5 text-blue-800">
                O Facebook não disponibiliza publicação automática oficial para anúncios comuns do Marketplace. No horário, o sistema avisa, copia o texto e abre o formulário correto para conclusão manual.
            </div>

            <FacebookMarketplaceCampaignPanel onGenerated={() => void load()} />

            {loading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Carregando fila...</div>
            ) : items.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">Nenhuma publicação programada.</div>
            ) : (
                <div className="divide-y divide-slate-100">
                    {items.map((item) => {
                        const status = effectiveStatus(item);
                        const ready = status === 'ready';
                        return (
                            <article key={item.id} className={ready ? 'bg-amber-50/50 p-5' : 'p-5'}>
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                        {item.image_urls[0] ? <img src={item.image_urls[0]} alt="" className="h-full w-full object-cover" /> : <Image className="m-6 h-8 w-8 text-slate-300" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${ready ? 'bg-amber-100 text-amber-800' : status === 'published' ? 'bg-emerald-100 text-emerald-700' : status === 'cancelled' ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>{statusLabel[status]}</span>
                                            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> {formatDateTime(item.scheduled_for)}</span>
                                        </div>
                                        <h3 className="mt-2 font-black text-slate-900">{item.product_name}</h3>
                                        <p className="text-sm font-bold text-emerald-700">{formatMoney(item.price_cents)}</p>
                                        <p className="mt-1 text-xs text-slate-500">{item.destinations.map((destination) => destination.name).join(' · ')}</p>
                                        <p className="mt-2 line-clamp-2 whitespace-pre-line text-xs text-slate-600">{item.description}</p>
                                        {item.destinations.some((destination) => destination.type === 'group' && destination.url) && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {item.destinations.filter((destination) => destination.type === 'group' && destination.url).map((destination, index) => (
                                                    <a key={`${destination.name}-${index}`} href={destination.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"><ExternalLink className="h-3 w-3" />{destination.name}</a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        {status !== 'published' && status !== 'cancelled' && (
                                            <button onClick={() => void preparePost(item)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><Copy className="h-3.5 w-3.5" /> Preparar e abrir</button>
                                        )}
                                        {status !== 'published' && status !== 'cancelled' && (
                                            <button onClick={() => void markPublished(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><CheckCircle2 className="h-3.5 w-3.5" /> Publicado</button>
                                        )}
                                        <button onClick={() => void remove(item)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
                    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
                            <div><h3 className="font-black text-slate-900">Programar anúncio no Facebook</h3><p className="text-xs text-slate-500">Marketplace principal e grupos de venda</p></div>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-5 p-6">
                            <div>
                                <label className="mb-1 block text-xs font-black uppercase text-slate-500">Produto</label>
                                {product ? (
                                    <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3"><div><p className="text-sm font-bold text-slate-900">{product.name}</p><p className="text-xs text-slate-500">SKU {product.sku}</p></div><button onClick={() => setProduct(null)} className="text-xs font-bold text-blue-700">Trocar</button></div>
                                ) : (
                                    <>
                                        <div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runSearch(); }} placeholder="Nome, SKU ou EAN" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button onClick={() => void runSearch()} className="rounded-lg bg-slate-900 px-3 text-white"><Search className="h-4 w-4" /></button></div>
                                        {searching && <p className="mt-2 text-xs text-slate-400">Buscando...</p>}
                                        {results.length > 0 && <div className="mt-2 max-h-44 divide-y overflow-y-auto rounded-lg border">{results.map((result) => <button key={result.id} onClick={() => fillFromProduct(result)} className="block w-full p-3 text-left hover:bg-slate-50"><span className="block text-sm font-bold">{result.name}</span><span className="text-xs text-slate-500">{formatMoney(result.price_promo || result.price_retail)}</span></button>)}</div>}
                                    </>
                                )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div><label className="mb-1 block text-xs font-black uppercase text-slate-500">Data e horário</label><input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
                                <div><label className="mb-1 block text-xs font-black uppercase text-slate-500">Preço (R$)</label><input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,00" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
                            </div>
                            <div><label className="mb-1 block text-xs font-black uppercase text-slate-500">Descrição pronta para copiar</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
                            <div><label className="mb-1 block text-xs font-black uppercase text-slate-500">Grupos de venda (selecione um ou vários)</label>{savedGroups.length > 0 && <div className="mb-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">{savedGroups.map((group) => { const checked = selectedGroupUrls.includes(group.url); return <label key={group.id} className={`flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm ${checked ? 'bg-blue-50 font-bold text-blue-800' : 'hover:bg-slate-50'}`}><input type="checkbox" checked={checked} onChange={() => setSelectedGroupUrls((current) => checked ? current.filter((url) => url !== group.url) : [...current, group.url])} />{group.name}</label>; })}</div>}<textarea value={groupLines} onChange={(event) => setGroupLines(event.target.value)} rows={3} placeholder={'Grupo adicional | https://facebook.com/groups/...'} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm" /><p className="mt-1 text-[11px] text-slate-400">Os grupos salvos aparecem acima. Use o campo somente para um destino avulso.</p></div>
                            <div><label className="mb-1 block text-xs font-black uppercase text-slate-500">Observações internas</label><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: destacar garantia e entrega" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div>
                        </div>
                        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4"><button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button><button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Programar</button></div>
                    </div>
                </div>
            )}
        </section>
    );
}
