import React, { useState, useEffect, useCallback } from 'react';
import { Coins, Settings, History, UserCog, Save, RefreshCw, Plus, Minus, BarChart2, Gift, Trash2, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
    getCashbackSettings,
    updateCashbackSettings,
    listAllTransactions,
    adminAdjustCoins,
    coinsToReais,
} from '../../services/cashbackService';
import type { CashbackSettings, CoinTransaction, CoinTransactionType } from '../../types/cashback';
import { customerService } from '../../services/customers';
import {
    listCoinPromotions,
    createCoinPromotion,
    deleteCoinPromotion,
    toggleCoinPromotion,
    type CoinPromotion,
} from '../../services/coinPromotionService';
import { supabase } from '../../services/supabase';

// ============================================================
// BADGES DE TIPO DE TRANSAÇÃO
// ============================================================
const TX_LABELS: Record<CoinTransactionType, { label: string; color: string }> = {
    earn_purchase: { label: 'Compra', color: 'bg-green-100 text-green-800' },
    earn_checkin: { label: 'Check-in', color: 'bg-blue-100 text-blue-800' },
    earn_streak: { label: 'Streak Bônus', color: 'bg-purple-100 text-purple-800' },
    earn_manual: { label: 'Crédito Admin', color: 'bg-teal-100 text-teal-800' },
    spend_discount: { label: 'Resgate', color: 'bg-orange-100 text-orange-800' },
    refund_cancel: { label: 'Estorno', color: 'bg-yellow-100 text-yellow-800' },
    expire: { label: 'Expirado', color: 'bg-red-100 text-red-800' },
    admin_adjust: { label: 'Ajuste Admin', color: 'bg-gray-100 text-gray-800' },
};

// ============================================================
// TAB: DASHBOARD
// ============================================================
interface DailyStat {
    label: string;
    value: number;
    color: string;
    sign?: string;
}

function DashboardTab() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DailyStat[]>([]);
    const [checkinCount, setCheckinCount] = useState(0);
    const [recentTx, setRecentTx] = useState<CoinTransaction[]>([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // Transações de hoje
            const { data: txToday } = await supabase
                .from('coin_transactions')
                .select('*')
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`)
                .order('created_at', { ascending: false });

            const todayTx: CoinTransaction[] = (txToday ?? []) as CoinTransaction[];

            const earned = todayTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
            const spent = todayTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
            const checkins = todayTx.filter(t => t.type === 'earn_checkin').length;

            // Total em circulação (soma de todas as coin_balances)
            const { data: balanceSum } = await supabase
                .from('coin_balances')
                .select('balance');
            const totalCirculation = (balanceSum ?? []).reduce((s: number, b: any) => s + (b.balance || 0), 0);

            setStats([
                { label: 'Moedas distribuídas hoje', value: earned, color: 'text-green-600', sign: '+' },
                { label: 'Moedas resgatadas hoje', value: spent, color: 'text-orange-600', sign: '-' },
                { label: 'Check-ins hoje', value: checkins, color: 'text-blue-600' },
                { label: 'Total em circulação', value: totalCirculation, color: 'text-yellow-600' },
            ]);
            setCheckinCount(checkins);
            setRecentTx(todayTx.slice(0, 20));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) return <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6">
            {/* Cards de estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
                        <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.color}`}>
                            {s.sign}{s.value.toLocaleString('pt-BR')}
                        </p>
                    </div>
                ))}
            </div>

            {/* Transações de hoje */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        Movimentações de Hoje
                    </h3>
                    <button onClick={load} className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Hora</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Descrição</th>
                                <th className="text-right px-4 py-3 font-medium text-slate-600">Moedas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recentTx.map(tx => {
                                const badge = TX_LABELS[tx.type];
                                return (
                                    <tr key={tx.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {new Date(tx.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{tx.description ?? '—'}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                                        </td>
                                    </tr>
                                );
                            })}
                            {recentTx.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nenhuma movimentação hoje ainda</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// TAB: PROMOÇÕES DE MOEDAS
// ============================================================
interface NewPromoForm {
    name: string;
    description: string;
    product_id: string;
    category_id: string;
    min_purchase: number;
    bonus_coins: number;
    expires_at: string;
    max_uses: string;
    active: boolean;
}

const EMPTY_FORM: NewPromoForm = {
    name: '',
    description: '',
    product_id: '',
    category_id: '',
    min_purchase: 0,
    bonus_coins: 50,
    expires_at: '',
    max_uses: '',
    active: true,
};

function PromotionsTab() {
    const [promos, setPromos] = useState<CoinPromotion[]>([]);
    const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState<NewPromoForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [promoData, prodData, catData] = await Promise.all([
                listCoinPromotions(),
                supabase.from('products').select('id, name').order('name').then(r => r.data ?? []),
                supabase.from('categories').select('id, name').order('name').then(r => r.data ?? []),
            ]);
            setPromos(promoData);
            setProducts(prodData as { id: string; name: string }[]);
            setCategories(catData as { id: string; name: string }[]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!form.name.trim()) return toast.error('Informe o nome da promoção');
        if (form.bonus_coins <= 0) return toast.error('Bônus de moedas deve ser maior que 0');
        if (!form.product_id && !form.category_id && form.min_purchase <= 0) {
            return toast.error('Defina: produto, categoria OU valor mínimo de compra');
        }

        setSaving(true);
        try {
            await createCoinPromotion({
                name: form.name,
                description: form.description || null,
                product_id: form.product_id || null,
                category_id: form.category_id || null,
                min_purchase: form.min_purchase,
                bonus_coins: form.bonus_coins,
                starts_at: new Date().toISOString(),
                expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
                max_uses: form.max_uses ? parseInt(form.max_uses) : null,
                active: form.active,
            });
            toast.success('Promoção criada!');
            setForm(EMPTY_FORM);
            setShowForm(false);
            load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id: string, active: boolean) => {
        await toggleCoinPromotion(id, !active);
        setPromos(p => p.map(pr => pr.id === id ? { ...pr, active: !active } : pr));
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta promoção?')) return;
        await deleteCoinPromotion(id);
        setPromos(p => p.filter(pr => pr.id !== id));
        toast.success('Promoção excluída');
    };

    if (loading) return <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-5">
            {/* Botão criar */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium text-sm transition-colors"
                >
                    <Gift className="w-4 h-4" />
                    Nova Promoção de Moedas
                </button>
            </div>

            {/* Formulário de criação */}
            {showForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-slate-800">Nova Promoção</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nome da Promoção *</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Ex: Compre Xiaomi 15 e ganhe 100 moedas"
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:border-yellow-500 bg-white"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Descrição (opcional)</label>
                            <input
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Detalhes para exibir ao cliente"
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:border-yellow-500 bg-white"
                            />
                        </div>

                        {/* Gatilho */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Produto específico</label>
                            <select
                                value={form.product_id}
                                onChange={e => setForm(f => ({ ...f, product_id: e.target.value, category_id: '', min_purchase: 0 }))}
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none bg-white"
                            >
                                <option value="">— Nenhum —</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Categoria inteira</label>
                            <select
                                value={form.category_id}
                                onChange={e => setForm(f => ({ ...f, category_id: e.target.value, product_id: '', min_purchase: 0 }))}
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none bg-white"
                            >
                                <option value="">— Nenhuma —</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">OU compra mínima (R$)</label>
                            <input
                                type="number"
                                min={0}
                                value={form.min_purchase}
                                onChange={e => setForm(f => ({ ...f, min_purchase: parseFloat(e.target.value) || 0, product_id: '', category_id: '' }))}
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none bg-white"
                            />
                        </div>

                        {/* Recompensa */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Bônus de Moedas *</label>
                            <input
                                type="number"
                                min={1}
                                value={form.bonus_coins}
                                onChange={e => setForm(f => ({ ...f, bonus_coins: parseInt(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none bg-white"
                            />
                        </div>

                        {/* Validade */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Válida até (opcional)</label>
                            <input
                                type="datetime-local"
                                value={form.expires_at}
                                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Limite de usos (vazio = ilimitado)</label>
                            <input
                                type="number"
                                min={1}
                                value={form.max_uses}
                                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                                placeholder="Ex: 100"
                                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none bg-white"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleCreate}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Salvando...' : 'Criar Promoção'}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-5 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de promoções */}
            {promos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                    <Gift className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma promoção cadastrada ainda.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {promos.map(promo => {
                        const expired = promo.expires_at && new Date(promo.expires_at) < new Date();
                        return (
                            <div
                                key={promo.id}
                                className={`flex items-center justify-between p-4 rounded-xl border ${promo.active && !expired ? 'border-yellow-200 bg-yellow-50' : 'border-slate-200 bg-slate-50 opacity-60'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-slate-800 text-sm">{promo.name}</span>
                                        <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded-full font-bold">
                                            +{promo.bonus_coins} moedas
                                        </span>
                                        {expired && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Expirada</span>}
                                        {!promo.active && <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">Inativa</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                                        {promo.products?.name && <span>📦 {promo.products.name}</span>}
                                        {promo.categories?.name && <span>🗂 {promo.categories.name}</span>}
                                        {!promo.product_id && !promo.category_id && promo.min_purchase > 0 && (
                                            <span>💰 Compra mín. R$ {promo.min_purchase.toFixed(2)}</span>
                                        )}
                                        {promo.expires_at && <span>📅 Até {new Date(promo.expires_at).toLocaleDateString('pt-BR')}</span>}
                                        {promo.max_uses && <span>🎟 {promo.uses_count}/{promo.max_uses} usos</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-3">
                                    <button
                                        onClick={() => handleToggle(promo.id, promo.active)}
                                        className="text-slate-500 hover:text-yellow-600 transition-colors"
                                        title={promo.active ? 'Desativar' : 'Ativar'}
                                    >
                                        {promo.active ? <ToggleRight className="w-5 h-5 text-yellow-500" /> : <ToggleLeft className="w-5 h-5" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(promo.id)}
                                        className="text-slate-400 hover:text-red-600 transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ============================================================
// TAB: CONFIGURAÇÕES
// ============================================================
function SettingsTab() {
    const [settings, setSettings] = useState<CashbackSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getCashbackSettings().then(setSettings).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await updateCashbackSettings(settings);
            toast.success('Configurações salvas!');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    const field = (label: string, key: keyof CashbackSettings, hint: string, type: 'number' | 'checkbox' = 'number') => (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            {type === 'checkbox' ? (
                <input
                    type="checkbox"
                    checked={settings?.[key] as boolean ?? false}
                    onChange={e => setSettings(s => s ? { ...s, [key]: e.target.checked } : s)}
                    className="w-4 h-4 text-blue-600 rounded"
                />
            ) : (
                <input
                    type="number"
                    min={0}
                    step="any"
                    value={settings?.[key] as number ?? 0}
                    onChange={e => setSettings(s => s ? { ...s, [key]: e.target.value === '' ? 0 : parseFloat(e.target.value) } : s)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                />
            )}
            <p className="text-xs text-slate-400 mt-1">{hint}</p>
        </div>
    );

    if (loading) return <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6">
            {/* Link para o regulamento público */}
            <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div>
                    <p className="text-sm font-medium text-amber-800">📄 Regulamento público das Moedas do Vale</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                        As informações desta página são exibidas dinamicamente — qualquer alteração aqui reflete imediatamente no regulamento.
                    </p>
                </div>
                <a
                    href="/moedas-do-vale"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 ml-4 flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                    Ver página →
                </a>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-700">Sistema ativo</span>
                <button
                    onClick={() => setSettings(s => s ? { ...s, active: !s.active } : s)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings?.active ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings?.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-500" /> Acúmulo por Compra
                    </h3>
                    {field('Moedas por R$ gasto', 'coins_per_real', 'Ex: 1 = 1 moeda a cada R$ 1 gasto')}
                    {field('Pedido mínimo (R$)', 'min_purchase_for_coins', 'Compras abaixo deste valor não geram moedas')}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-slate-800">💸 Resgate</h3>
                    {field('Moedas para R$ 1,00', 'coins_to_brl_rate', 'Ex: 100 = 100 moedas equivalem a R$ 1,00')}
                    {field('Desconto máximo (%)', 'max_redeem_percent', 'Máx % do pedido pago com moedas (ex: 20)')}
                    {field('Mínimo para resgatar (moedas)', 'min_coins_to_redeem', 'Saldo mínimo exigido para resgatar')}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-slate-800">🤝 Indicações e Compartilhamento</h3>
                    {field('Moedas por Venda Indicada', 'coins_per_referral_purchase', 'Qtd. de moedas que o cliente ganha quando alguém compra usando seu código')}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 md:col-span-2">
                    <div>
                        <h3 className="font-semibold text-slate-800 mb-0.5">📅 Check-in Diário — Ciclo Progressivo</h3>
                        <p className="text-xs text-slate-400">Defina quantas moedas o cliente ganha em cada dia do ciclo. No dia seguinte ao último, o ciclo reinicia do dia 1. O último dia é sempre o bônus maior (🎁).</p>
                    </div>
                    {(() => {
                        const vals: number[] = (settings as any)?.checkin_daily_values ?? [5, 10, 15, 20, 25, 30, 50];
                        const setVals = (updated: number[]) =>
                            setSettings(s => s ? { ...s, checkin_daily_values: updated } as any : s);
                        return (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {vals.map((v, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                {idx === vals.length - 1 ? '🎁 Dia ' : 'Dia '}{idx + 1}
                                            </span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={v}
                                                onChange={e => {
                                                    const copy = [...vals];
                                                    copy[idx] = parseInt(e.target.value) || 1;
                                                    setVals(copy);
                                                }}
                                                className={`w-14 text-center px-1 py-1.5 border rounded-lg text-sm font-bold focus:outline-none focus:border-yellow-500
                                                    ${idx === vals.length - 1 ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-700'}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                                {/* Botões adicionar/remover dia */}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setVals([...vals, vals[vals.length - 1] + 10])}
                                        className="flex items-center gap-1 px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                                    >
                                        <Plus className="w-3 h-3" /> Adicionar dia
                                    </button>
                                    {vals.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => setVals(vals.slice(0, -1))}
                                            className="flex items-center gap-1 px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-red-50 text-red-500"
                                        >
                                            <Minus className="w-3 h-3" /> Remover último
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold text-slate-800">⏳ Expiração</h3>
                    {field('Expirar após (dias)', 'coins_expire_after_days', '0 ou vazio = nunca expira')}
                </div>
            </div>

            {settings && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                    <strong>Preview:</strong>{' '}
                    Compra de R$ 100 → <strong>{Math.floor(100 * settings.coins_per_real)} moedas</strong> |{' '}
                    100 moedas → <strong>R$ {coinsToReais(100, settings.coins_to_brl_rate).toFixed(2)}</strong>
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
        </div>
    );
}

// ============================================================
// TAB: TRANSAÇÕES
// ============================================================
function TransactionsTab() {
    const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<CoinTransactionType | ''>('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listAllTransactions({ type: filterType || undefined, limit: 200 });
            setTransactions(data);
        } finally {
            setLoading(false);
        }
    }, [filterType]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-4">
            <div className="flex gap-3">
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value as any)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
                >
                    <option value="">Todos os tipos</option>
                    {Object.entries(TX_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <button onClick={load} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-8"><RefreshCw className="animate-spin text-slate-400" /></div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Tipo</th>
                                <th className="text-left px-4 py-3 font-medium text-slate-600">Descrição</th>
                                <th className="text-right px-4 py-3 font-medium text-slate-600">Moedas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {transactions.map(tx => {
                                const badge = TX_LABELS[tx.type];
                                return (
                                    <tr key={tx.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{tx.description ?? '—'}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                                        </td>
                                    </tr>
                                );
                            })}
                            {transactions.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Nenhuma transação encontrada</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ============================================================
// TAB: AJUSTE MANUAL
// ============================================================
function ManualAdjustTab() {
    const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [amount, setAmount] = useState(0);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        customerService.list().then(data =>
            setCustomers(data.map(c => ({ id: c.id, name: c.name })))
        );
    }, []);

    const handleAdjust = async (sign: 1 | -1) => {
        if (!selectedCustomer) return toast.error('Selecione um cliente');
        if (!amount || amount <= 0) return toast.error('Informe uma quantidade válida');
        if (!reason.trim()) return toast.error('Informe o motivo');
        setSaving(true);
        try {
            await adminAdjustCoins(selectedCustomer, sign * amount, reason);
            toast.success(`${sign > 0 ? '+' : '-'}${amount} moedas ${sign > 0 ? 'adicionadas' : 'removidas'}!`);
            setAmount(0);
            setReason('');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-lg space-y-4">
            <p className="text-sm text-slate-500">Adicione ou remova moedas manualmente de um cliente.</p>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select
                    value={selectedCustomer}
                    onChange={e => setSelectedCustomer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                    <option value="">Selecione...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Moedas</label>
                <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={e => setAmount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
                <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ex: Bônus de aniversário"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
            </div>
            <div className="flex gap-3">
                <button
                    onClick={() => handleAdjust(1)}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> Adicionar
                </button>
                <button
                    onClick={() => handleAdjust(-1)}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                >
                    <Minus className="w-4 h-4" /> Remover
                </button>
            </div>
        </div>
    );
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================
const TABS = [
    { id: 'dashboard', label: 'Dashboard', Icon: BarChart2 },
    { id: 'promotions', label: 'Promoções', Icon: Gift },
    { id: 'settings', label: 'Configurações', Icon: Settings },
    { id: 'transactions', label: 'Transações', Icon: History },
    { id: 'adjust', label: 'Ajuste Manual', Icon: UserCog },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CashbackPage() {
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-xl">
                    <Coins className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Moedas do Vale</h1>
                    <p className="text-sm text-slate-500">Gerencie o sistema de fidelidade por moedas</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === id
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Conteúdo */}
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'promotions' && <PromotionsTab />}
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'transactions' && <TransactionsTab />}
            {activeTab === 'adjust' && <ManualAdjustTab />}
        </div>
    );
}
