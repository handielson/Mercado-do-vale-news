import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    BookOpen, Settings, RefreshCw, Loader2, AlertCircle,
    ChevronDown, ChevronUp, Store, ShoppingBag, Calculator,
    Calendar, TrendingUp, ReceiptText,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchNfEmitidas, clearNfCache, type BlingNfItem } from '../../../services/blingNfService';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;

// ─── Simples Nacional Engine ─────────────────────────────────────────────────

interface SimplesAnexo { name: string; faixas: { limite: number; aliquota: number; deducao: number }[]; }
const SIMPLES_ANEXOS: Record<string, SimplesAnexo> = {
    I:   { name: 'Anexo I — Comércio', faixas: [ {limite:180000,aliquota:.04,deducao:0},{limite:360000,aliquota:.073,deducao:5940},{limite:720000,aliquota:.095,deducao:13860},{limite:1440000,aliquota:.107,deducao:22500},{limite:1800000,aliquota:.143,deducao:87300},{limite:3600000,aliquota:.19,deducao:378000} ] },
    II:  { name: 'Anexo II — Indústria', faixas: [ {limite:180000,aliquota:.045,deducao:0},{limite:360000,aliquota:.078,deducao:5940},{limite:720000,aliquota:.10,deducao:13860},{limite:1440000,aliquota:.112,deducao:22500},{limite:1800000,aliquota:.147,deducao:85500},{limite:3600000,aliquota:.30,deducao:720000} ] },
    III: { name: 'Anexo III — Serviços (locação)', faixas: [ {limite:180000,aliquota:.06,deducao:0},{limite:360000,aliquota:.112,deducao:9360},{limite:720000,aliquota:.135,deducao:17640},{limite:1440000,aliquota:.16,deducao:35640},{limite:1800000,aliquota:.21,deducao:125640},{limite:3600000,aliquota:.33,deducao:648000} ] },
    IV:  { name: 'Anexo IV — Serviços (construção)', faixas: [ {limite:180000,aliquota:.045,deducao:0},{limite:360000,aliquota:.09,deducao:8100},{limite:720000,aliquota:.102,deducao:12420},{limite:1440000,aliquota:.14,deducao:39780},{limite:1800000,aliquota:.22,deducao:183780},{limite:3600000,aliquota:.33,deducao:828000} ] },
    V:   { name: 'Anexo V — Serviços (TI)', faixas: [ {limite:180000,aliquota:.155,deducao:0},{limite:360000,aliquota:.18,deducao:4500},{limite:720000,aliquota:.195,deducao:9900},{limite:1440000,aliquota:.205,deducao:17100},{limite:1800000,aliquota:.23,deducao:62100},{limite:3600000,aliquota:.305,deducao:540000} ] },
};

interface SimplesResult { faixa: number; aliquotaNominal: number; deducao: number; aliquotaEfetiva: number; }
function calcSimples(rbt12: number, anexo: string): SimplesResult | null {
    if (!rbt12 || rbt12 <= 0) return null;
    const tab = SIMPLES_ANEXOS[anexo]; if (!tab) return null;
    const idx = tab.faixas.findIndex(f => rbt12 <= f.limite);
    const fi = idx === -1 ? tab.faixas.length - 1 : idx;
    const { aliquota, deducao } = tab.faixas[fi];
    return { faixa: fi + 1, aliquotaNominal: aliquota, deducao, aliquotaEfetiva: Math.max(0, (rbt12 * aliquota - deducao) / rbt12) };
}

// ─── Config persistence ───────────────────────────────────────────────────────

const CONFIG_KEY = 'contabilidade_config_v2';
interface AccountingConfig {
    anexo: string;
    dataInicio: string;   // "YYYY-MM-DD"
    diaCorte: number;     // 1–28, default 20
    rbt12Override: number; // 0 = auto
}
function loadConfig(): AccountingConfig {
    try { const r = localStorage.getItem(CONFIG_KEY); if (r) return JSON.parse(r); } catch { /* */ }
    const now = new Date();
    return { anexo: 'I', dataInicio: `${now.getFullYear() - 1}-01-01`, diaCorte: 20, rbt12Override: 0 };
}
function saveConfig(c: AccountingConfig) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); } catch { /* */ }
}

/** Returns the date 12 months ago in YYYY-MM-DD format */
function twelveMonthsAgo(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
}

// ─── Shopee cache reader ──────────────────────────────────────────────────────

interface ShopeeItem {
    order_sn: string;
    create_time: number;
    order_status: string;
    buyer_total_amount: number;
    shipping_fee: number;
    product_value: number;
    escrow_amount: number;
    fee: number;
}

function loadShopeeItems(): ShopeeItem[] {
    try {
        const raw = localStorage.getItem('shopee_finance_v4');
        if (!raw) return [];
        const cache = JSON.parse(raw);
        return Object.values(cache.items || {}) as ShopeeItem[];
    } catch { return []; }
}

// ─── Competence helpers ───────────────────────────────────────────────────────

/** Returns "YYYY-MM" competence key for a given date and cut-off day.
 *  If dateDay > cutoff, competence = next month.
 *  Example: date=2025-01-25, cutoff=20 → "2025-02"
 */
function getCompetencia(dateStr: string, diaCorte: number): string {
    const d = new Date(dateStr + 'T12:00:00');
    if (d.getDate() > diaCorte) {
        d.setMonth(d.getMonth() + 1);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dasVencimento(comp: string): string {
    // DAS vence no dia 20 do mês seguinte à competência
    const [y, m] = comp.split('-').map(Number);
    const next = new Date(y, m, 20); // m is already 0-indexed after +1
    return next.toLocaleDateString('pt-BR');
}

function compLabel(comp: string): string {
    const [y, m] = comp.split('-').map(Number);
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${months[m - 1]}/${y}`;
}

// ─── Monthly row ─────────────────────────────────────────────────────────────

interface MonthRow {
    comp: string;           // "YYYY-MM"
    shopee: number;         // product_value sum (sem frete)
    lojaFisica: number;     // totalProdutos sum (sem frete)
    total: number;
    aliquota: number;
    imposto: number;
    dasVence: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AccountingPage() {
    const [config, setConfig] = useState<AccountingConfig>(loadConfig);
    const [showConfig, setShowConfig] = useState(false);
    const [overrideInput, setOverrideInput] = useState(String(loadConfig().rbt12Override || ''));

    // NF-e state
    const [nfItems, setNfItems] = useState<BlingNfItem[]>([]);
    const [nfLoading, setNfLoading] = useState(false);
    const [nfError, setNfError] = useState('');

    // Shopee
    const shopeeItems = useMemo(() => loadShopeeItems(), []);

    // ── Auto RBT12: sum of last 12 months Shopee COMPLETED + NF-e
    const rbt12Auto = useMemo(() => {
        const cutoff = twelveMonthsAgo();
        let total = 0;
        for (const it of shopeeItems) {
            if (it.order_status !== 'COMPLETED' || !it.create_time) continue;
            const d = new Date(it.create_time * 1000).toISOString().split('T')[0];
            if (d >= cutoff) total += it.product_value || 0;
        }
        for (const it of nfItems) {
            if (it.dataEmissao >= cutoff) total += it.totalProdutos || 0;
        }
        return total;
    }, [shopeeItems, nfItems]);

    // Effective RBT12: manual override if set, otherwise auto
    const rbt12Efetivo = config.rbt12Override > 0 ? config.rbt12Override : rbt12Auto;

    const taxResult = useMemo(() => calcSimples(rbt12Efetivo, config.anexo), [rbt12Efetivo, config.anexo]);

    // ── Tab
    const [tab, setTab] = useState<'shopee' | 'fisica' | 'consolidado'>('consolidado');

    // ── Fetch NF-e
    const fetchNf = useCallback(async (force = false) => {
        setNfLoading(true);
        setNfError('');
        try {
            const today = new Date().toISOString().split('T')[0];
            const items = await fetchNfEmitidas({ dataInicio: config.dataInicio, dataFim: today, forceRefresh: force });
            setNfItems(items);
        } catch (e: any) {
            setNfError(e.message || 'Erro ao buscar NF-e no Bling');
        } finally {
            setNfLoading(false);
        }
    }, [config.dataInicio]);

    useEffect(() => { fetchNf(); }, [fetchNf]);

    // ── Config save helper
    function updateConfig(patch: Partial<AccountingConfig>) {
        const next = { ...config, ...patch };
        setConfig(next);
        saveConfig(next);
    }

    // ── Monthly aggregation
    const monthRows = useMemo<MonthRow[]>(() => {
        const map: Record<string, { shopee: number; lojaFisica: number }> = {};

        // Shopee — only COMPLETED
        for (const it of shopeeItems) {
            if (it.order_status !== 'COMPLETED') continue;
            if (!it.create_time) continue;
            const dateStr = new Date(it.create_time * 1000).toISOString().split('T')[0];
            if (dateStr < config.dataInicio) continue;
            const comp = getCompetencia(dateStr, config.diaCorte);
            if (!map[comp]) map[comp] = { shopee: 0, lojaFisica: 0 };
            map[comp].shopee += it.product_value || 0;
        }

        // Loja Física — NF-e emitidas
        for (const it of nfItems) {
            if (it.dataEmissao < config.dataInicio) continue;
            const comp = getCompetencia(it.dataEmissao, config.diaCorte);
            if (!map[comp]) map[comp] = { shopee: 0, lojaFisica: 0 };
            map[comp].lojaFisica += it.totalProdutos || 0;
        }

        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([comp, { shopee, lojaFisica }]) => {
                const total = shopee + lojaFisica;
                const aliquota = taxResult?.aliquotaEfetiva ?? 0;
                return { comp, shopee, lojaFisica, total, aliquota, imposto: total * aliquota, dasVence: dasVencimento(comp) };
            });
    }, [shopeeItems, nfItems, config.dataInicio, config.diaCorte, taxResult]);

    const totals = useMemo(() => ({
        shopee: monthRows.reduce((s, r) => s + r.shopee, 0),
        lojaFisica: monthRows.reduce((s, r) => s + r.lojaFisica, 0),
        total: monthRows.reduce((s, r) => s + r.total, 0),
        imposto: monthRows.reduce((s, r) => s + r.imposto, 0),
    }), [monthRows]);

    // ─── Shopee detail table items (filtered by dataInicio, only COMPLETED)
    const shopeeDetail = useMemo(() =>
        shopeeItems
            .filter(it => it.order_status === 'COMPLETED' && it.create_time)
            .filter(it => new Date(it.create_time * 1000).toISOString().split('T')[0] >= config.dataInicio)
            .sort((a, b) => b.create_time - a.create_time),
        [shopeeItems, config.dataInicio]
    );

    // ─── NF-e detail table
    const nfDetail = useMemo(() =>
        [...nfItems].sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao)),
        [nfItems]
    );

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">

            {/* ── Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <BookOpen className="text-white" size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Contabilidade</h1>
                        <p className="text-sm text-slate-500">Receita tributável consolidada por competência · Simples Nacional</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowConfig(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors">
                        <Settings size={15} /> Configurações
                        {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => { clearNfCache(); fetchNf(true); toast.info('Cache NF-e limpo, rebuscando…'); }}
                        disabled={nfLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50">
                        <RefreshCw size={15} className={nfLoading ? 'animate-spin' : ''} />
                        Atualizar NF-e
                    </button>
                </div>
            </div>

            {/* ── Config Panel */}
            {showConfig && (
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5 space-y-4">
                    <h2 className="text-sm font-black text-indigo-800 uppercase tracking-wide flex items-center gap-2">
                        <Calculator size={16} /> Configurações Contábeis
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Data de início */}
                        <div>
                            <label className="block text-xs font-bold text-indigo-700 mb-1">Início do período contábil</label>
                            <input type="date" value={config.dataInicio}
                                onChange={e => updateConfig({ dataInicio: e.target.value })}
                                className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                            <p className="text-xs text-indigo-400 mt-1">Data a partir da qual contar a receita</p>
                        </div>
                        {/* Dia de corte */}
                        <div>
                            <label className="block text-xs font-bold text-indigo-700 mb-1">Dia de corte mensal</label>
                            <input type="number" min={1} max={28} value={config.diaCorte}
                                onChange={e => updateConfig({ diaCorte: parseInt(e.target.value) || 20 })}
                                className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                            <p className="text-xs text-indigo-400 mt-1">Padrão: dia 20 (prazo DAS Simples)</p>
                        </div>
                        {/* RBT12 — auto-calculado */}
                        <div>
                            <label className="block text-xs font-bold text-indigo-700 mb-1">RBT12 — Calculado automaticamente</label>
                            <div className="w-full px-3 py-2.5 bg-indigo-100/60 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-800">
                                {fmt(rbt12Auto)} <span className="font-normal text-indigo-500 text-xs">/ últimos 12 meses</span>
                            </div>
                            <p className="text-xs text-indigo-400 mt-1">Soma de Shopee + NF-e dos últimos 12 meses</p>
                        </div>
                        {/* Override manual opcional */}
                        <div>
                            <label className="block text-xs font-bold text-indigo-700 mb-1">Override manual do RBT12 <span className="font-normal text-indigo-400">(opcional)</span></label>
                            <input type="number" placeholder={`Deixe vazio = usar ${fmt(rbt12Auto)}`} value={overrideInput}
                                onChange={e => setOverrideInput(e.target.value)}
                                onBlur={() => updateConfig({ rbt12Override: parseFloat(overrideInput.replace(',', '.')) || 0 })}
                                className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300" />
                            <p className="text-xs text-indigo-400 mt-1">{config.rbt12Override > 0 ? '⚠️ Override ativo — apague para usar automático' : 'Informe apenas se quiser substituir o valor calculado'}</p>
                        </div>
                        {/* Anexo */}
                        <div>
                            <label className="block text-xs font-bold text-indigo-700 mb-1">Anexo do Simples Nacional</label>
                            <select value={config.anexo} onChange={e => updateConfig({ anexo: e.target.value })}
                                className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300">
                                {Object.entries(SIMPLES_ANEXOS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {taxResult && (
                        <div className="bg-white/80 rounded-xl px-4 py-3 border border-indigo-100 text-sm text-indigo-900">
                            <span className="font-bold">📊 Resultado:</span>{' '}
                            RBT12 <span className="text-indigo-500 text-xs">{config.rbt12Override > 0 ? '(manual)' : '(automático)'}</span>{' '}
                            <strong>{fmt(rbt12Efetivo)}</strong> →
                            Faixa <strong>{taxResult.faixa}ª</strong> do {SIMPLES_ANEXOS[config.anexo]?.name},
                            Alíquota nominal <strong>{fmtPct(taxResult.aliquotaNominal)}</strong>,
                            Dedução <strong>{fmt(taxResult.deducao)}</strong>{' '}
                            → Alíquota efetiva: <strong className="text-lg text-violet-700">{fmtPct(taxResult.aliquotaEfetiva)}</strong>
                        </div>
                    )}
                    {!taxResult && (
                        <p className="text-xs text-indigo-400">Aguardando dados para calcular o RBT12…</p>
                    )}
                </div>
            )}

            {/* ── Error */}
            {nfError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle size={18} className="shrink-0" />
                    <p className="text-sm">{nfError} — <span className="font-semibold">verifique a conexão com o Bling</span></p>
                </div>
            )}

            {/* ── Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <ShoppingBag size={16} className="text-orange-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Shopee</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{fmt(totals.shopee)}</div>
                    <div className="text-xs text-slate-400 mt-1">{shopeeDetail.length} pedidos concluídos</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Store size={16} className="text-blue-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Loja Física</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800">{fmt(totals.lojaFisica)}</div>
                    <div className="text-xs text-slate-400 mt-1">{nfDetail.length} NF-e/NFC-e emitidas</div>
                </div>
                <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={16} className="text-violet-200" />
                        <span className="text-xs font-bold text-violet-200 uppercase tracking-wide">Total Tributável</span>
                    </div>
                    <div className="text-2xl font-black text-white">{fmt(totals.total)}</div>
                    <div className="text-xs text-violet-300 mt-1">Base para cálculo do DAS</div>
                </div>
                <div className="bg-white rounded-2xl p-5 border-2 border-orange-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <ReceiptText size={16} className="text-orange-500" />
                        <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">DAS Estimado</span>
                    </div>
                    <div className="text-2xl font-black text-orange-600">{fmt(totals.imposto)}</div>
                    <div className="text-xs text-orange-400 mt-1">
                        {taxResult ? fmtPct(taxResult.aliquotaEfetiva) + ' efetivo' : 'Aguardando dados…'}
                    </div>
                </div>
            </div>

            {/* ── Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-max">
                {[
                    { key: 'consolidado', label: '📅 Por Competência', icon: Calendar },
                    { key: 'shopee', label: '🛒 Shopee', icon: ShoppingBag },
                    { key: 'fisica', label: '🏪 Loja Física', icon: Store },
                ] .map(({ key, label }) => (
                    <button key={key} onClick={() => setTab(key as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-white shadow text-indigo-700 ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Tab: Consolidado (monthly) */}
            {tab === 'consolidado' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="font-bold text-slate-700">Resumo por Competência</h2>
                        <span className="text-xs text-slate-400">Dia de corte: {config.diaCorte} · RBT12 {config.rbt12Override > 0 ? 'manual' : 'auto'}: {fmt(rbt12Efetivo)} · {taxResult ? `Alíquota: ${fmtPct(taxResult.aliquotaEfetiva)}` : 'Aguardando dados…'}</span>
                    </div>
                    {monthRows.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                            <p>Nenhum dado encontrado</p>
                            <p className="text-sm mt-1">Verifique a data de início e a conexão com o Bling</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="py-3 px-4 font-bold text-slate-600 text-left">Competência</th>
                                        <th className="py-3 px-4 font-bold text-orange-600 text-right">Shopee 🛒</th>
                                        <th className="py-3 px-4 font-bold text-blue-600 text-right">Loja Física 🏪</th>
                                        <th className="py-3 px-4 font-bold text-violet-700 text-right">Total</th>
                                        <th className="py-3 px-4 font-bold text-slate-500 text-right">Alíquota</th>
                                        <th className="py-3 px-4 font-bold text-orange-600 text-right">Imposto 🧾</th>
                                        <th className="py-3 px-4 font-bold text-slate-500 text-right">DAS Vence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthRows.map(row => (
                                        <tr key={row.comp} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-4 font-bold text-slate-800">{compLabel(row.comp)}</td>
                                            <td className="py-3 px-4 text-right text-orange-600 font-medium">{row.shopee > 0 ? fmt(row.shopee) : '—'}</td>
                                            <td className="py-3 px-4 text-right text-blue-600 font-medium">{row.lojaFisica > 0 ? fmt(row.lojaFisica) : '—'}</td>
                                            <td className="py-3 px-4 text-right font-black text-violet-700">{fmt(row.total)}</td>
                                            <td className="py-3 px-4 text-right text-slate-500">{row.aliquota > 0 ? fmtPct(row.aliquota) : '—'}</td>
                                            <td className="py-3 px-4 text-right font-bold text-orange-600">{row.imposto > 0 ? fmt(row.imposto) : '—'}</td>
                                            <td className="py-3 px-4 text-right text-slate-500 text-xs">{row.dasVence}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                                    <tr>
                                        <td className="py-3 px-4 font-black text-slate-700">TOTAL</td>
                                        <td className="py-3 px-4 text-right font-black text-orange-600">{fmt(totals.shopee)}</td>
                                        <td className="py-3 px-4 text-right font-black text-blue-600">{fmt(totals.lojaFisica)}</td>
                                        <td className="py-3 px-4 text-right font-black text-violet-700">{fmt(totals.total)}</td>
                                        <td className="py-3 px-4 text-right text-slate-400">—</td>
                                        <td className="py-3 px-4 text-right font-black text-orange-600">{fmt(totals.imposto)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Shopee detail */}
            {tab === 'shopee' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h2 className="font-bold text-slate-700">Detalhe — Pedidos Shopee concluídos</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Base: valor dos produtos (sem frete) · {shopeeDetail.length} pedidos</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="py-3 px-4 font-bold text-slate-600 text-left">Data</th>
                                    <th className="py-3 px-4 font-bold text-slate-600 text-left">Pedido</th>
                                    <th className="py-3 px-4 font-bold text-slate-600 text-right">Bruto</th>
                                    <th className="py-3 px-4 font-bold text-blue-600 text-right">Sem Frete ★</th>
                                    <th className="py-3 px-4 font-bold text-slate-500 text-right">Competência</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shopeeDetail.map(it => {
                                    const dateStr = new Date(it.create_time * 1000).toISOString().split('T')[0];
                                    const comp = getCompetencia(dateStr, config.diaCorte);
                                    return (
                                        <tr key={it.order_sn} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="py-2 px-4 text-slate-500 text-xs">{new Date(it.create_time * 1000).toLocaleDateString('pt-BR')}</td>
                                            <td className="py-2 px-4">
                                                <a href={`https://seller.shopee.com.br/portal/sale/detail?ordersn=${it.order_sn}`}
                                                    target="_blank" rel="noopener noreferrer"
                                                    className="font-bold text-orange-600 hover:underline">
                                                    #{it.order_sn}
                                                </a>
                                            </td>
                                            <td className="py-2 px-4 text-right text-slate-700">{fmt(it.buyer_total_amount)}</td>
                                            <td className="py-2 px-4 text-right font-bold text-blue-700">{fmt(it.product_value)}</td>
                                            <td className="py-2 px-4 text-right text-slate-500 text-xs">{compLabel(comp)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {shopeeDetail.length === 0 && (
                            <div className="py-12 text-center text-slate-400 text-sm">
                                Sem dados no cache da Shopee. Acesse Shopee → Financeiro para carregar.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab: Loja Física detail */}
            {tab === 'fisica' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-700">Detalhe — NF-e / NFC-e emitidas (Bling)</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Apenas situação "Emitida" · {nfDetail.length} documentos</p>
                        </div>
                        {nfLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="py-3 px-4 font-bold text-slate-600 text-left">Emissão</th>
                                    <th className="py-3 px-4 font-bold text-slate-600 text-left">Nº / Tipo</th>
                                    <th className="py-3 px-4 font-bold text-slate-600 text-left">Destinatário</th>
                                    <th className="py-3 px-4 font-bold text-blue-600 text-right">Valor Produtos</th>
                                    <th className="py-3 px-4 font-bold text-slate-500 text-right">Total Nota</th>
                                    <th className="py-3 px-4 font-bold text-slate-500 text-right">Competência</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nfDetail.map(it => {
                                    const comp = getCompetencia(it.dataEmissao, config.diaCorte);
                                    return (
                                        <tr key={`${it.tipo}-${it.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                                            <td className="py-2 px-4 text-slate-500 text-xs whitespace-nowrap">
                                                {it.dataEmissao.split('-').reverse().join('/')}
                                            </td>
                                            <td className="py-2 px-4">
                                                <span className="font-bold text-slate-700">Nº {it.numero}</span>
                                                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-bold ${it.tipo === 'nfe' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                    {it.tipo.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="py-2 px-4 text-slate-600 text-xs">{it.contato?.nome || '—'}</td>
                                            <td className="py-2 px-4 text-right font-bold text-blue-700">{fmt(it.totalProdutos)}</td>
                                            <td className="py-2 px-4 text-right text-slate-500">{fmt(it.totalNota)}</td>
                                            <td className="py-2 px-4 text-right text-slate-500 text-xs">{compLabel(comp)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {nfDetail.length === 0 && !nfLoading && (
                            <div className="py-12 text-center text-slate-400 text-sm">
                                {nfError ? 'Erro ao carregar.' : 'Nenhuma NF-e/NFC-e encontrada no período.'}
                            </div>
                        )}
                        {nfLoading && (
                            <div className="py-12 text-center text-slate-400 flex items-center justify-center gap-2">
                                <Loader2 size={18} className="animate-spin" /> Buscando NF-e no Bling…
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
