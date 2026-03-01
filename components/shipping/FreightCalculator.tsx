import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, Package, AlertTriangle, CheckCircle, Loader2, Calculator } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { shippingService } from '../../services/shippingService';
import { melhorEnvioService } from '../../services/melhorEnvio';
import type { ShippingSettings } from '../../types/shipping';
import { cn } from '../../utils/cn';

// ── Limites dos Correios (Sedex / PAC) ───────────────────────────────────────
const CORREIOS_LIMITS = {
    weight_kg_max: 30,
    dim_max_cm: 100,   // cada dimensão individualmente
    sum_max_cm: 200,   // height + width + length
    weight_kg_min: 0.3,
    height_min: 2,
    width_min: 11,
    length_min: 16,
};

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ProductDimension {
    id: string;
    name: string;
    sku?: string;
    weight_g: number | null;   // gramas
    height_cm: number | null;  // cm
    width_cm: number | null;   // cm
    length_cm: number | null;  // cm
}

interface CartItem {
    product: ProductDimension;
    qty: number;
}

interface CarrierResult {
    id: string;
    name: string;
    carrier?: string;
    price: number;
    daysLabel: string;
    error?: string;
}

interface FreightCalculatorProps {
    originCep: string;
    secondaryCep?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCep(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function hasDimensions(p: ProductDimension) {
    return p.weight_g != null && p.height_cm != null && p.width_cm != null && p.length_cm != null;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function FreightCalculator({ originCep, secondaryCep }: FreightCalculatorProps) {
    // CEPs
    const [useSecondary, setUseSecondary] = useState(false);
    const [destCep, setDestCep] = useState('');

    // Info dos CEPs (endereço completo)
    const [originInfo, setOriginInfo] = useState<string | null>(null);
    const [secondaryInfo, setSecondaryInfo] = useState<string | null>(null);
    const [destInfo, setDestInfo] = useState<string | null>(null);
    const [loadingDestCep, setLoadingDestCep] = useState(false);

    // Produtos
    const [allProducts, setAllProducts] = useState<ProductDimension[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Carrinho
    const [cart, setCart] = useState<CartItem[]>([]);

    // Cálculo
    const [calculating, setCalculating] = useState(false);
    const [results, setResults] = useState<CarrierResult[] | null>(null);
    const [calcError, setCalcError] = useState<string | null>(null);

    // Shipping Settings (token)
    const [settings, setSettings] = useState<ShippingSettings | null>(null);

    // ── Load ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        loadProducts();
        shippingService.getSettings().then(setSettings);
    }, []);

    // Lookup ViaCEP para CEPs de origem ao carregar
    useEffect(() => {
        if (originCep && originCep.replace(/\D/g, '').length === 8) {
            lookupCep(originCep).then(setOriginInfo);
        }
    }, [originCep]);

    useEffect(() => {
        if (secondaryCep && secondaryCep.replace(/\D/g, '').length >= 7) {
            lookupCep(secondaryCep).then(setSecondaryInfo);
        }
    }, [secondaryCep]);

    // Lookup do CEP de destino com debounce
    useEffect(() => {
        setDestInfo(null);
        if (destCep.replace(/\D/g, '').length !== 8) return;
        const timer = setTimeout(async () => {
            setLoadingDestCep(true);
            const info = await lookupCep(destCep);
            setDestInfo(info);
            setLoadingDestCep(false);
        }, 600);
        return () => clearTimeout(timer);
    }, [destCep]);

    async function lookupCep(cep: string): Promise<string | null> {
        try {
            const clean = cep.replace(/\D/g, '');
            const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
            const data = await res.json();
            if (data.erro) return null;
            const parts = [
                data.logradouro,
                data.bairro,
                data.localidade && data.uf ? `${data.localidade} - ${data.uf}` : (data.localidade || data.uf),
            ].filter(Boolean);
            return parts.join(', ');
        } catch {
            return null;
        }
    }

    async function loadProducts() {
        setLoadingProducts(true);

        // Busca produtos ativos com model_id
        const { data: products } = await supabase
            .from('products')
            .select('id, name, sku, model_id')
            .eq('status', 'active')
            .not('model_id', 'is', null)
            .order('name');

        if (!products || products.length === 0) {
            setAllProducts([]);
            setLoadingProducts(false);
            return;
        }

        // Busca template_values dos modelos (contém peso/dimensões)
        const modelIds = [...new Set(products.map((p: any) => p.model_id).filter(Boolean))];
        const { data: models } = await supabase
            .from('models')
            .select('id, template_values')
            .in('id', modelIds);

        const modelMap = new Map((models ?? []).map((m: any) => [m.id, m.template_values ?? {}]));

        setAllProducts(products.map((p: any) => {
            const tv: any = modelMap.get(p.model_id) ?? {};

            // Campos exatos do banco: weight_kg (numérico) e dimensions.* (com ponto na chave)
            const rawWeight = tv['weight_kg'] != null ? tv['weight_kg'] * 1000 : null;
            const height_cm = tv['dimensions.height_cm'] ?? null;
            const width_cm = tv['dimensions.width_cm'] ?? null;
            const length_cm = tv['dimensions.depth_cm'] ?? null;

            return {
                id: p.id,
                name: p.name,
                sku: p.sku,
                weight_g: typeof rawWeight === 'number' ? rawWeight : null,
                height_cm: typeof height_cm === 'number' ? height_cm : null,
                width_cm: typeof width_cm === 'number' ? width_cm : null,
                length_cm: typeof length_cm === 'number' ? length_cm : null,
            };
        }));

        setLoadingProducts(false);
    }

    // ── Filtro de busca ───────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (!search.trim()) return allProducts.slice(0, 8);
        const q = search.toLowerCase();
        return allProducts.filter(p =>
            p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
        ).slice(0, 8);
    }, [search, allProducts]);

    // Fechar dropdown clicando fora
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Carrinho ──────────────────────────────────────────────────────────────
    function addToCart(product: ProductDimension) {
        setCart(prev => {
            const existing = prev.find(i => i.product.id === product.id);
            if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { product, qty: 1 }];
        });
        setSearch('');
        setShowDropdown(false);
        setResults(null);
    }

    function changeQty(id: string, delta: number) {
        setCart(prev => prev
            .map(i => i.product.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
            .filter(i => i.qty > 0)
        );
        setResults(null);
    }

    function removeItem(id: string) {
        setCart(prev => prev.filter(i => i.product.id !== id));
        setResults(null);
    }

    // ── Totais consolidados ───────────────────────────────────────────────────
    const totals = useMemo(() => {
        const itemsWithDimensions = cart.filter(i => hasDimensions(i.product));
        if (itemsWithDimensions.length === 0) return null;

        let weight_g = 0;
        let height_cm = 0;
        let width_cm = 0;
        let length_cm = 0;

        for (const item of itemsWithDimensions) {
            weight_g += (item.product.weight_g ?? 0) * item.qty;
            // Empilhamento: soma alturas, mantém maior largura e comprimento
            height_cm += (item.product.height_cm ?? 0) * item.qty;
            width_cm = Math.max(width_cm, item.product.width_cm ?? 0);
            length_cm = Math.max(length_cm, item.product.length_cm ?? 0);
        }

        return { weight_g, weight_kg: weight_g / 1000, height_cm, width_cm, length_cm };
    }, [cart]);

    // ── Validação Correios ────────────────────────────────────────────────────
    const correiosViolations = useMemo(() => {
        if (!totals) return [];
        const v: string[] = [];
        if (totals.weight_kg > CORREIOS_LIMITS.weight_kg_max) v.push(`Peso ${totals.weight_kg.toFixed(2)}kg > máx ${CORREIOS_LIMITS.weight_kg_max}kg`);
        if (totals.height_cm > CORREIOS_LIMITS.dim_max_cm) v.push(`Altura ${totals.height_cm}cm > máx ${CORREIOS_LIMITS.dim_max_cm}cm`);
        if (totals.width_cm > CORREIOS_LIMITS.dim_max_cm) v.push(`Largura ${totals.width_cm}cm > máx ${CORREIOS_LIMITS.dim_max_cm}cm`);
        if (totals.length_cm > CORREIOS_LIMITS.dim_max_cm) v.push(`Comprimento ${totals.length_cm}cm > máx ${CORREIOS_LIMITS.dim_max_cm}cm`);
        const sum = totals.height_cm + totals.width_cm + totals.length_cm;
        if (sum > CORREIOS_LIMITS.sum_max_cm) v.push(`Soma (A+L+C) ${sum}cm > máx ${CORREIOS_LIMITS.sum_max_cm}cm`);
        return v;
    }, [totals]);

    const missingDimensions = useMemo(() =>
        cart.filter(i => !hasDimensions(i.product)).map(i => i.product.name),
        [cart]);

    const canCalculate = cart.length > 0
        && totals !== null
        && correiosViolations.length === 0
        && destCep.replace(/\D/g, '').length === 8
        && settings?.melhor_envio_token;

    // ── Calcular ──────────────────────────────────────────────────────────────
    async function handleCalculate() {
        if (!totals || !settings?.melhor_envio_token) return;

        setCalculating(true);
        setCalcError(null);
        setResults(null);

        const fromCep = useSecondary && secondaryCep ? secondaryCep : originCep;

        try {
            // Usa proxy /api/melhor-envio-calculate
            // Em dev: Vite redireciona para mercado-do-vale-news.vercel.app (vite.config.ts)
            // Em prod: endpoint Vercel serverless, sem CORS
            const res = await fetch('/api/melhor-envio-calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_cep: fromCep,
                    to_cep: destCep,
                    weight_g: totals.weight_g,
                    height_cm: totals.height_cm,
                    width_cm: totals.width_cm,
                    length_cm: totals.length_cm,
                    token: settings.melhor_envio_token,
                    sandbox: settings.melhor_envio_sandbox,
                }),
            });

            const text = await res.text();
            if (!text) throw new Error('Resposta vazia do servidor de frete');

            const data = JSON.parse(text);
            if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`);

            const carriers: CarrierResult[] = (Array.isArray(data) ? data : [])
                .filter((item: any) => !item.error && item.price)
                .map((item: any) => ({
                    id: `me_${item.id}`,
                    name: item.name,
                    carrier: item.company?.name,
                    price: parseFloat(item.price ?? '0'),
                    daysLabel: item.delivery_time ? `${item.delivery_time} dias úteis` : '?',
                }))
                .sort((a: CarrierResult, b: CarrierResult) => a.price - b.price);

            setResults(carriers);
        } catch (err: any) {
            const msg = err.message ?? 'Erro ao calcular frete';
            // CORS em dev: orientar o usuário
            if (msg.includes('fetch') || msg.includes('Failed')) {
                setCalcError('Erro de conexão com o Melhor Envio. Em desenvolvimento, o proxy Vite redireciona para o Vercel de produção — verifique se o endpoint foi deployado ou ative o modo Sandbox nas configurações.');
            } else {
                setCalcError(msg);
            }
        } finally {
            setCalculating(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* CEP de Origem */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">📍 CEP de Origem</h3>
                <div className="space-y-2">
                    <label className={cn('flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-colors', !useSecondary ? 'border-blue-500 bg-blue-50' : 'border-slate-200')}>
                        <input type="radio" checked={!useSecondary} onChange={() => setUseSecondary(false)} className="accent-blue-600" />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">Endereço da Loja</span>
                                <span className="font-mono text-sm text-blue-700">{originCep || '—'}</span>
                            </div>
                            {originInfo && (
                                <p className="text-xs text-slate-500 mt-0.5">📍 {originInfo}</p>
                            )}
                        </div>
                    </label>
                    {secondaryCep && (
                        <label className={cn('flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-colors', useSecondary ? 'border-blue-500 bg-blue-50' : 'border-slate-200')}>
                            <input type="radio" checked={useSecondary} onChange={() => setUseSecondary(true)} className="accent-blue-600" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-800">CEP Alternativo</span>
                                    <span className="font-mono text-sm text-blue-700">{secondaryCep}</span>
                                </div>
                                {secondaryInfo && (
                                    <p className="text-xs text-slate-500 mt-0.5">📍 {secondaryInfo}</p>
                                )}
                                {!secondaryInfo && secondaryCep.replace(/\D/g, '').length < 8 && (
                                    <p className="text-xs text-amber-600 mt-0.5">⚠️ CEP incompleto ({secondaryCep.replace(/\D/g, '').length} dígitos) — corrija em Configurações</p>
                                )}
                                {!secondaryInfo && secondaryCep.replace(/\D/g, '').length >= 8 && (
                                    <p className="text-xs text-slate-400 mt-0.5">Buscando endereço...</p>
                                )}
                            </div>
                        </label>
                    )}
                    {!secondaryCep && (
                        <p className="text-xs text-slate-400">Configure o CEP alternativo na aba Configurações.</p>
                    )}
                </div>
            </div>

            {/* CEP de Destino */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <h3 className="text-sm font-semibold text-slate-700">📦 CEP de Destino</h3>
                <div className="flex items-center gap-3">
                    <input
                        className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        placeholder="56000-000"
                        maxLength={9}
                        value={destCep}
                        onChange={e => { setDestCep(formatCep(e.target.value)); setResults(null); }}
                    />
                    {loadingDestCep && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    {destInfo && !loadingDestCep && (
                        <span className="text-sm text-slate-600">📍 {destInfo}</span>
                    )}
                    {destCep.replace(/\D/g, '').length === 8 && !loadingDestCep && !destInfo && (
                        <span className="text-sm text-red-500">CEP não encontrado</span>
                    )}
                </div>
            </div>

            {/* Busca de Produtos */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">🔍 Adicionar Produtos ao Orçamento</h3>
                <div className="relative" ref={searchRef}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Buscar produto por nome ou SKU..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                            onFocus={() => setShowDropdown(true)}
                        />
                    </div>
                    {showDropdown && (
                        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                            {loadingProducts ? (
                                <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-sm">Nenhum produto encontrado</div>
                            ) : (
                                filtered.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0"
                                    >
                                        <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {p.sku && <span className="font-mono">{p.sku} · </span>}
                                                {hasDimensions(p)
                                                    ? `${(p.weight_g! / 1000).toFixed(3)}kg · ${p.height_cm}×${p.width_cm}×${p.length_cm}cm`
                                                    : '⚠️ sem dados de envio'}
                                            </p>
                                        </div>
                                        <Plus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Carrinho */}
            {cart.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-700">🛒 Itens do Orçamento</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {cart.map(item => (
                            <div key={item.product.id} className="flex items-center gap-3 px-5 py-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{item.product.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {hasDimensions(item.product)
                                            ? `${(item.product.weight_g! / 1000).toFixed(3)}kg · ${item.product.height_cm}×${item.product.width_cm}×${item.product.length_cm}cm (unit.)`
                                            : <span className="text-amber-600">⚠️ sem dados de envio</span>
                                        }
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => changeQty(item.product.id, -1)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600">
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                                    <button onClick={() => changeQty(item.product.id, +1)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-blue-600">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <button onClick={() => removeItem(item.product.id)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Totais consolidados */}
                    {totals && (
                        <div className={cn('px-5 py-4 border-t', correiosViolations.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200')}>
                            <div className="flex items-start gap-2">
                                {correiosViolations.length > 0
                                    ? <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    : <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />}
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-slate-700 mb-1">Totais Consolidados</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                        <div>
                                            <span className="text-slate-500">Peso</span>
                                            <span className={cn('ml-1 font-bold', totals.weight_kg > CORREIOS_LIMITS.weight_kg_max ? 'text-red-600' : 'text-slate-800')}>
                                                {totals.weight_kg.toFixed(3)} kg
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Altura</span>
                                            <span className={cn('ml-1 font-bold', totals.height_cm > CORREIOS_LIMITS.dim_max_cm ? 'text-red-600' : 'text-slate-800')}>
                                                {totals.height_cm} cm
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Largura</span>
                                            <span className={cn('ml-1 font-bold', totals.width_cm > CORREIOS_LIMITS.dim_max_cm ? 'text-red-600' : 'text-slate-800')}>
                                                {totals.width_cm} cm
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Comprimento</span>
                                            <span className={cn('ml-1 font-bold', totals.length_cm > CORREIOS_LIMITS.dim_max_cm ? 'text-red-600' : 'text-slate-800')}>
                                                {totals.length_cm} cm
                                            </span>
                                        </div>
                                    </div>
                                    {correiosViolations.length > 0 && (
                                        <div className="mt-2 space-y-0.5">
                                            {correiosViolations.map(v => (
                                                <p key={v} className="text-xs text-red-700">⚠️ {v}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {missingDimensions.length > 0 && (
                        <div className="px-5 py-3 bg-amber-50 border-t border-amber-200">
                            <p className="text-xs text-amber-700">
                                ⚠️ Produtos sem dados de envio (ignorados no cálculo): {missingDimensions.join(', ')}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Botão Calcular */}
            {cart.length > 0 && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCalculate}
                        disabled={!canCalculate || calculating}
                        className={cn(
                            'flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all',
                            canCalculate && !calculating
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        )}
                    >
                        {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        {calculating ? 'Calculando...' : 'Calcular Frete'}
                    </button>
                    {!settings?.melhor_envio_token && (
                        <p className="text-xs text-amber-600">Configure o token do Melhor Envio na aba Transportadoras para calcular.</p>
                    )}
                    {correiosViolations.length > 0 && (
                        <p className="text-xs text-red-600">Reduza o pedido — excede limites dos Correios.</p>
                    )}
                </div>
            )}

            {/* Erro de cálculo */}
            {calcError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                    <strong>Erro:</strong> {calcError}
                </div>
            )}

            {/* Resultados */}
            {results && results.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-700">🚚 Opções de Frete</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {results.filter(r => !r.error).map((r, i) => (
                            <div key={r.id} className={cn('flex items-center px-5 py-4 gap-4', i === 0 ? 'bg-green-50' : '')}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800 text-sm">{r.name}</span>
                                        {i === 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Mais barato</span>}
                                    </div>
                                    {r.carrier && <p className="text-xs text-slate-500 mt-0.5">{r.carrier}</p>}
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">{r.price === 0 ? 'Grátis' : `R$ ${r.price.toFixed(2)}`}</p>
                                    <p className="text-xs text-slate-500">{r.daysLabel}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {results && results.filter(r => !r.error).length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
                    Nenhuma transportadora disponível para este trecho. Verifique os CEPs e o token do Melhor Envio.
                </div>
            )}
        </div>
    );
}
