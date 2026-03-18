import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Package } from 'lucide-react';
import { FreightCalculator } from '../../../components/shipping/FreightCalculator';
import { shippingService } from '../../../services/shippingService';
import type {
    ShippingSettings,
    ShippingZone,
    ShippingZoneInput,
    ShippingPriceRange,
    ShippingPriceRangeInput,
    ShippingZoneType,
} from '../../../types/shipping';
import { toast } from 'sonner';

type Tab = 'config' | 'zones' | 'ranges' | 'carriers' | 'calculator';

const COMMON_CARRIERS = [
    { id: 'correios', label: 'Correios (PAC/SEDEX)' },
    { id: 'jadlog', label: 'Jadlog' },
    { id: 'loggi', label: 'Loggi' },
    { id: 'azul', label: 'Azul Cargo' },
    { id: 'latam', label: 'LATAM Cargo' },
    { id: 'buslog', label: 'Buslog' }
];

const ZONE_TYPE_LABELS: Record<ShippingZoneType, string> = {
    local_free: '🎁 Entrega Local Grátis',
    local_paid: '🛵 Entrega Local Paga',
    national: '📦 Nacional',
};

const ZONE_TYPE_COLORS: Record<ShippingZoneType, string> = {
    local_free: 'bg-green-100 text-green-800 border-green-200',
    local_paid: 'bg-blue-100 text-blue-800 border-blue-200',
    national: 'bg-purple-100 text-purple-800 border-purple-200',
};

// ─── Zone Form ────────────────────────────────────────────────────────────────

function ZoneForm({ zone, onSave, onCancel }: {
    zone?: ShippingZone;
    onSave: (input: ShippingZoneInput) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState<ShippingZoneInput>({
        name: zone?.name ?? '',
        type: zone?.type ?? 'local_free',
        enabled: zone?.enabled ?? true,
        cities: zone?.cities ?? [],
        cep_ranges: zone?.cep_ranges ?? [],
        max_km_free: zone?.max_km_free ?? null,
        price_per_km: zone?.price_per_km ?? null,
        fixed_price: zone?.fixed_price ?? null,
        min_order_free: zone?.min_order_free ?? null,
        estimated_days_min: zone?.estimated_days_min ?? 0,
        estimated_days_max: zone?.estimated_days_max ?? 1,
        display_order: zone?.display_order ?? 0,
    });

    const [cityInput, setCityInput] = useState('');
    const [cepInput, setCepInput] = useState('');

    const set = <K extends keyof ShippingZoneInput>(k: K, v: ShippingZoneInput[K]) =>
        setForm(prev => ({ ...prev, [k]: v }));

    const addCity = () => {
        const city = cityInput.trim();
        if (city && !form.cities?.includes(city)) {
            set('cities', [...(form.cities ?? []), city]);
        }
        setCityInput('');
    };

    const addCep = () => {
        const cep = cepInput.trim();
        if (cep) set('cep_ranges', [...(form.cep_ranges ?? []), cep]);
        setCepInput('');
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Nome da Zona *</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Petrolina - Frete Grátis" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={form.type} onChange={e => set('type', e.target.value as ShippingZoneType)}>
                        {(Object.keys(ZONE_TYPE_LABELS) as ShippingZoneType[]).map(t => (
                            <option key={t} value={t}>{ZONE_TYPE_LABELS[t]}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Cities */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cidades Cobertas</label>
                <div className="flex gap-2 mb-2">
                    <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={cityInput} onChange={e => setCityInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCity())}
                        placeholder="Digite um cidade e pressione Enter" />
                    <button onClick={addCity} type="button" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                        <Plus size={16} />
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {form.cities?.map((city, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-800 rounded-full text-xs">
                            {city}
                            <button onClick={() => set('cities', form.cities!.filter((_, j) => j !== i))} className="hover:text-red-600"><X size={12} /></button>
                        </span>
                    ))}
                </div>
            </div>

            {/* CEP Ranges */}
            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Faixas de CEP</label>
                <p className="text-xs text-slate-400 mb-1">Formato: 56000-000:56099-999 (de:até)</p>
                <div className="flex gap-2 mb-2">
                    <input className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={cepInput} onChange={e => setCepInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCep())}
                        placeholder="56000-000:56099-999" />
                    <button onClick={addCep} type="button" className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                        <Plus size={16} />
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {form.cep_ranges?.map((r, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-mono">
                            {r}
                            <button onClick={() => set('cep_ranges', form.cep_ranges!.filter((_, j) => j !== i))} className="hover:text-red-600"><X size={12} /></button>
                        </span>
                    ))}
                </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Raio Grátis (km)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.max_km_free ?? ''} onChange={e => set('max_km_free', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ex: 15" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Pedido mínimo p/ grátis (R$)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.min_order_free ?? ''} onChange={e => set('min_order_free', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ex: 100" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {form.type === 'national' ? 'Preço Fixo (Deixe em branco p/ calcular via Correios/Melhor Envio)' : 'Preço Fixo (R$)'}
                    </label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.fixed_price ?? ''} onChange={e => set('fixed_price', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ex: 15,00" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Preço por KM (R$)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.price_per_km ?? ''} onChange={e => set('price_per_km', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ex: 1,50" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Prazo mín. (dias)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.estimated_days_min} onChange={e => set('estimated_days_min', Number(e.target.value))} />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Prazo máx. (dias)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.estimated_days_max} onChange={e => set('estimated_days_max', Number(e.target.value))} />
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={() => onSave(form)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Check size={16} /> Salvar Zona
                </button>
            </div>
        </div>
    );
}

// ─── Price Range Form ─────────────────────────────────────────────────────────

function PriceRangeForm({ range, zoneId, onSave, onCancel }: {
    range?: ShippingPriceRange;
    zoneId: string;
    onSave: (input: ShippingPriceRangeInput) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState<ShippingPriceRangeInput>({
        zone_id: zoneId,
        label: range?.label ?? '',
        min_km: range?.min_km ?? 0,
        max_km: range?.max_km,
        price: range?.price ?? 0,
        estimated_days_min: range?.estimated_days_min ?? 0,
        estimated_days_max: range?.estimated_days_max ?? 1,
    });

    const set = <K extends keyof ShippingPriceRangeInput>(k: K, v: ShippingPriceRangeInput[K]) =>
        setForm(prev => ({ ...prev, [k]: v }));

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={form.label} onChange={e => set('label', e.target.value)} placeholder='Ex: "Até 10km", "10 a 20km"' />
            <div className="grid grid-cols-4 gap-2">
                <div>
                    <label className="text-xs text-slate-500">De (km)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none"
                        value={form.min_km} onChange={e => set('min_km', Number(e.target.value))} />
                </div>
                <div>
                    <label className="text-xs text-slate-500">Até (km)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none"
                        value={form.max_km ?? ''} onChange={e => set('max_km', e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="∞" />
                </div>
                <div>
                    <label className="text-xs text-slate-500">Preço (R$)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none"
                        value={form.price} onChange={e => set('price', Number(e.target.value))} />
                </div>
                <div>
                    <label className="text-xs text-slate-500">Prazo (dias)</label>
                    <input type="number" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none"
                        value={form.estimated_days_max} onChange={e => set('estimated_days_max', Number(e.target.value))} />
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button onClick={() => onSave(form)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ShippingPage() {
    const [searchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') === 'calcular' ? 'calculator' : 'config') as Tab;
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [settings, setSettings] = useState<ShippingSettings | null>(null);
    const [zones, setZones] = useState<ShippingZone[]>([]);
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
    const [priceRanges, setPriceRanges] = useState<ShippingPriceRange[]>([]);
    const [loading, setLoading] = useState(true);
    const [showZoneForm, setShowZoneForm] = useState(false);
    const [editingZone, setEditingZone] = useState<ShippingZone | undefined>();
    const [showRangeForm, setShowRangeForm] = useState(false);
    const [editingRange, setEditingRange] = useState<ShippingPriceRange | undefined>();
    const [settingsForm, setSettingsForm] = useState({
        origin_cep: '',
        secondary_origin_cep: '',
        melhor_envio_token: '',
        melhor_envio_sandbox: true,
        melhor_envio_enabled: false,
        melhor_envio_allowed_services: '',
        frenet_token: '',
        frenet_enabled: false,
        local_delivery_enabled: true
    });

    useEffect(() => { loadAll(); }, []);
    useEffect(() => {
        if (selectedZoneId) {
            shippingService.getPriceRanges(selectedZoneId).then(setPriceRanges);
        }
    }, [selectedZoneId]);

    async function loadAll() {
        setLoading(true);
        const [s, z] = await Promise.all([shippingService.getSettings(), shippingService.getZones()]);
        if (s) {
            setSettings(s);
            setSettingsForm({
                origin_cep: s.origin_cep,
                secondary_origin_cep: (s as any).secondary_origin_cep ?? '',
                melhor_envio_token: s.melhor_envio_token ?? '',
                melhor_envio_sandbox: s.melhor_envio_sandbox,
                melhor_envio_enabled: s.melhor_envio_enabled,
                melhor_envio_allowed_services: s.melhor_envio_allowed_services ?? '',
                frenet_token: s.frenet_token ?? '',
                frenet_enabled: s.frenet_enabled ?? false,
                local_delivery_enabled: s.local_delivery_enabled,
            });
        }
        setZones(z);
        setLoading(false);
    }

    async function handleSaveSettings() {
        try {
            await shippingService.saveSettings(settingsForm);
            toast.success('Configurações salvas!');
            loadAll();
        } catch { toast.error('Erro ao salvar configurações'); }
    }

    async function handleSaveZone(input: ShippingZoneInput) {
        try {
            await shippingService.saveZone(input, editingZone?.id);
            toast.success('Zona salva!');
            setShowZoneForm(false);
            setEditingZone(undefined);
            loadAll();
        } catch { toast.error('Erro ao salvar zona'); }
    }

    async function handleDeleteZone(id: string) {
        if (!confirm('Remover esta zona? As faixas de preço vinculadas também serão removidas.')) return;
        try {
            await shippingService.deleteZone(id);
            toast.success('Zona removida!');
            if (selectedZoneId === id) setSelectedZoneId(null);
            loadAll();
        } catch { toast.error('Erro ao remover zona'); }
    }

    async function handleToggleZone(zone: ShippingZone) {
        try {
            const input: ShippingZoneInput = {
                name: zone.name,
                type: zone.type,
                enabled: !zone.enabled,
                cities: zone.cities,
                cep_ranges: zone.cep_ranges,
                max_km_free: zone.max_km_free,
                price_per_km: zone.price_per_km,
                fixed_price: zone.fixed_price,
                min_order_free: zone.min_order_free,
                estimated_days_min: zone.estimated_days_min,
                estimated_days_max: zone.estimated_days_max,
                display_order: zone.display_order
            };
            await shippingService.saveZone(input, zone.id);
            toast.success(input.enabled ? 'Zona ativada!' : 'Zona desativada!');
            loadAll();
        } catch (error) {
            console.error('Erro ao alternar zona:', error);
            toast.error('Erro ao alterar status da zona. Verifique o console.');
        }
    }

    async function handleSaveRange(input: ShippingPriceRangeInput) {
        try {
            await shippingService.savePriceRange(input, editingRange?.id);
            toast.success('Faixa salva!');
            setShowRangeForm(false);
            setEditingRange(undefined);
            if (selectedZoneId) setPriceRanges(await shippingService.getPriceRanges(selectedZoneId));
        } catch { toast.error('Erro ao salvar faixa'); }
    }

    async function handleDeleteRange(id: string) {
        await shippingService.deletePriceRange(id);
        if (selectedZoneId) setPriceRanges(await shippingService.getPriceRanges(selectedZoneId));
    }

    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: 'config', label: 'Configurações', icon: '⚙️' },
        { id: 'zones', label: 'Zonas de Entrega', icon: '📍' },
        { id: 'ranges', label: 'Faixas de Preço', icon: '💰' },
        { id: 'carriers', label: 'Transportadoras', icon: '🚚' },
        { id: 'calculator', label: 'Calcular Frete', icon: '🧮' },
    ];

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-50 rounded-xl">
                    <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Configuração de Frete</h1>
                    <p className="text-sm text-slate-500">Gerencie zonas de entrega, preços e transportadoras</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Menu Lateral */}
                <div className="w-full md:w-64 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm sticky top-24">
                    <nav className="flex flex-col gap-1.5">
                        {tabs.map(t => {
                            const isActive = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                            ? 'bg-blue-50 text-blue-800 shadow-sm border border-blue-200/60'
                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xl ${isActive ? 'opacity-100' : 'opacity-60'}`}>{t.icon}</span>
                                        {t.label}
                                    </div>
                                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Conteúdo Principal */}
                <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    {/* Tab: Configurações */}
                    {activeTab === 'config' && (
                        <div className="space-y-5">
                            <h2 className="text-base font-semibold text-slate-800">Configurações Gerais</h2>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">CEP de Origem (loja)</label>
                                <input className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={settingsForm.origin_cep}
                                    onChange={e => setSettingsForm(p => ({ ...p, origin_cep: e.target.value }))}
                                    placeholder="56000-000" maxLength={9} />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">CEP Alternativo (ex: depósito)</label>
                                <input className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={settingsForm.secondary_origin_cep}
                                    onChange={e => setSettingsForm(p => ({ ...p, secondary_origin_cep: e.target.value }))}
                                    placeholder="56000-000" maxLength={9} />
                                <p className="text-xs text-slate-400 mt-1">Usado como segunda opção na calculadora de frete avulso.</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <button onClick={() => setSettingsForm(p => ({ ...p, local_delivery_enabled: !p.local_delivery_enabled }))}>
                                    {settingsForm.local_delivery_enabled
                                        ? <ToggleRight className="w-8 h-8 text-green-600" />
                                        : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                                </button>
                                <div>
                                    <p className="text-sm font-medium text-slate-800">Entrega Local Ativa</p>
                                    <p className="text-xs text-slate-500">Usar as zonas configuradas para calcular frete local</p>
                                </div>
                            </div>

                            <button onClick={handleSaveSettings} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                                <Check size={16} /> Salvar Configurações
                            </button>
                        </div>
                    )}

                    {/* Tab: Zonas */}
                    {activeTab === 'zones' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-slate-500">{zones.length} zona(s) configurada(s)</p>
                                <button onClick={() => { setShowZoneForm(true); setEditingZone(undefined); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                                    <Plus size={16} /> Nova Zona
                                </button>
                            </div>

                            {showZoneForm && (
                                <ZoneForm zone={editingZone} onSave={handleSaveZone} onCancel={() => { setShowZoneForm(false); setEditingZone(undefined); }} />
                            )}

                            {zones.length === 0 && !showZoneForm && (
                                <div className="text-center py-12 text-slate-400">
                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p>Nenhuma zona configurada ainda.</p>
                                    <p className="text-sm mt-1">Clique em "Nova Zona" para começar.</p>
                                </div>
                            )}

                            {zones.map(zone => (
                                <div key={zone.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="flex items-center gap-3 p-4">
                                        <button onClick={() => handleToggleZone(zone)} className="flex-shrink-0">
                                            {zone.enabled
                                                ? <ToggleRight className="w-7 h-7 text-green-600" />
                                                : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                                        </button>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-slate-900">{zone.name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ZONE_TYPE_COLORS[zone.type]}`}>
                                                    {ZONE_TYPE_LABELS[zone.type]}
                                                </span>
                                                {!zone.enabled && <span className="text-xs text-slate-400">Inativa</span>}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-2">
                                                {zone.cities && zone.cities.length > 0 && (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                        Cidades: {zone.cities.join(', ')}
                                                    </span>
                                                )}
                                                {zone.cep_ranges && zone.cep_ranges.length > 0 && (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                        CEPs: {zone.cep_ranges.length} faixa(s)
                                                    </span>
                                                )}
                                                {zone.max_km_free != null && (
                                                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 font-medium">
                                                        Grátis até {zone.max_km_free}km
                                                    </span>
                                                )}
                                                {zone.min_order_free != null && (
                                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-medium">
                                                        Mín. p/ Grátis: R$ {zone.min_order_free.toFixed(2).replace('.', ',')}
                                                    </span>
                                                )}
                                                {zone.fixed_price != null && (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                        Fixo: R$ {zone.fixed_price.toFixed(2).replace('.', ',')}
                                                    </span>
                                                )}
                                                {zone.price_per_km != null && (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                        R$ {zone.price_per_km.toFixed(2).replace('.', ',')}/km
                                                    </span>
                                                )}
                                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                    Prazo: {zone.estimated_days_min} a {zone.estimated_days_max} dias
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingZone(zone); setShowZoneForm(true); }}
                                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteZone(zone.id)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tab: Faixas de Preço */}
                    {activeTab === 'ranges' && (
                        <div className="space-y-4">
                            {/* Zone selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Selecione a Zona</label>
                                <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={selectedZoneId ?? ''} onChange={e => setSelectedZoneId(e.target.value || null)}>
                                    <option value="">-- Selecione uma zona --</option>
                                    {zones.map(z => (
                                        <option key={z.id} value={z.id}>{z.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedZoneId && (
                                <>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-slate-500">{priceRanges.length} faixa(s) configurada(s)</p>
                                        <button onClick={() => { setShowRangeForm(true); setEditingRange(undefined); }}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                                            <Plus size={16} /> Adicionar Faixa
                                        </button>
                                    </div>

                                    {showRangeForm && (
                                        <PriceRangeForm zoneId={selectedZoneId} range={editingRange}
                                            onSave={handleSaveRange}
                                            onCancel={() => { setShowRangeForm(false); setEditingRange(undefined); }} />
                                    )}

                                    {priceRanges.length === 0 && !showRangeForm && (
                                        <div className="text-center py-10 text-slate-400">
                                            <p>Nenhuma faixa cadastrada para esta zona.</p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {priceRanges.map(range => (
                                            <div key={range.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
                                                <div className="flex-1">
                                                    <span className="font-medium text-slate-800 text-sm">{range.label}</span>
                                                    <span className="text-xs text-slate-400 ml-2">({range.min_km}km → {range.max_km ?? '∞'}km)</span>
                                                </div>
                                                <span className={`text-sm font-semibold ${range.price === 0 ? 'text-green-600' : 'text-slate-800'}`}>
                                                    {range.price === 0 ? 'Grátis' : `R$ ${range.price.toFixed(2)}`}
                                                </span>
                                                <span className="text-xs text-slate-400">{range.estimated_days_max}d</span>
                                                <div className="flex gap-1">
                                                    <button onClick={() => { setEditingRange(range); setShowRangeForm(true); }}
                                                        className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button onClick={() => handleDeleteRange(range.id)}
                                                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-500">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Tab: Transportadoras */}
                    {activeTab === 'carriers' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">
                                Configure as integrações com transportadoras para cálculo de frete nacional.
                                Quando ativas, os fretes aparecem para clientes de fora das Zonas Locais.
                            </p>

                            {/* Melhor Envio */}
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🚚</span>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">Melhor Envio</p>
                                            <p className="text-xs text-slate-500">Correios, Jadlog, Loggi e mais</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSettingsForm(p => ({ ...p, melhor_envio_enabled: !p.melhor_envio_enabled }))}>
                                        {settingsForm.melhor_envio_enabled
                                            ? <ToggleRight className="w-8 h-8 text-green-600" />
                                            : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                                    </button>
                                </div>
                                <div className="px-5 py-4 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setSettingsForm(p => ({ ...p, melhor_envio_sandbox: !p.melhor_envio_sandbox }))}>
                                            {settingsForm.melhor_envio_sandbox
                                                ? <ToggleRight className="w-7 h-7 text-amber-500" />
                                                : <ToggleLeft className="w-7 h-7 text-slate-400" />}
                                        </button>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">Modo Sandbox</p>
                                            <p className="text-xs text-slate-500">Desative após validar para ir a produção</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Token de API</label>
                                        <input type="password"
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            value={settingsForm.melhor_envio_token}
                                            onChange={e => setSettingsForm(p => ({ ...p, melhor_envio_token: e.target.value }))}
                                            placeholder="eyJ0eXAiOiJKV1..." />
                                        <p className="text-xs text-slate-400 mt-1">
                                            Gere em <a href="https://sandbox.melhorenvio.com.br/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">sandbox.melhorenvio.com.br/tokens</a>
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800 mb-2">Transportadoras Permitidas</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {COMMON_CARRIERS.map(carrier => {
                                                const allowed_services_array = settingsForm.melhor_envio_allowed_services
                                                    .split(',')
                                                    .map(s => s.trim().toLowerCase())
                                                    .filter(Boolean);
                                                const isChecked = allowed_services_array.includes(carrier.id.toLowerCase());
                                                return (
                                                    <label key={carrier.id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                                        <div className="flex items-center h-5">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    let newList = [...allowed_services_array];
                                                                    if (checked && !newList.includes(carrier.id)) newList.push(carrier.id);
                                                                    else if (!checked) newList = newList.filter(id => id !== carrier.id);
                                                                    setSettingsForm(prev => ({ ...prev, melhor_envio_allowed_services: newList.join(',') }));
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-800">{carrier.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Frenet */}
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">📦</span>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">Frenet</p>
                                            <p className="text-xs text-slate-500">Correios com taxas negociadas</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSettingsForm(p => ({ ...p, frenet_enabled: !p.frenet_enabled }))}>
                                        {settingsForm.frenet_enabled
                                            ? <ToggleRight className="w-8 h-8 text-green-600" />
                                            : <ToggleLeft className="w-8 h-8 text-slate-400" />}
                                    </button>
                                </div>
                                <div className="px-5 py-4 space-y-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Token de API</label>
                                        <input type="password"
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            value={settingsForm.frenet_token}
                                            onChange={e => setSettingsForm(p => ({ ...p, frenet_token: e.target.value }))}
                                            placeholder="Seu token da Frenet" />
                                        <p className="text-xs text-slate-400 mt-1">
                                            Acesse em <a href="https://painel.frenet.com.br" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">painel.frenet.com.br</a> → Dados Cadastrais → Chaves de Acesso
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleSaveSettings} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                                <Check size={16} /> Salvar Transportadoras
                            </button>
                        </div>
                    )}

                    {/* Tab: Calcular Frete */}
                    {activeTab === 'calculator' && (
                        <FreightCalculator
                            originCep={settingsForm.origin_cep}
                            secondaryCep={settingsForm.secondary_origin_cep || undefined}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
