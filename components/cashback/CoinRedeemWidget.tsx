import React, { useState, useEffect } from 'react';
import { Coins, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import {
    getCoinBalance,
    getCashbackSettings,
    validateCoinRedeem,
    redeemCoins,
    coinsToReais,
} from '../../services/cashbackService';
import type { CashbackSettings, CoinBalance } from '../../types/cashback';

interface CoinRedeemWidgetProps {
    customerId: string;
    orderValueBrl: number;           // Valor do pedido em R$
    onDiscountApplied: (discountBrl: number, coinsUsed: number) => void;
    onDiscountCleared: () => void;
    appliedDiscount?: number;        // Desconto já aplicado em R$ (externo)
    disabled?: boolean;
}

export default function CoinRedeemWidget({
    customerId,
    orderValueBrl,
    onDiscountApplied,
    onDiscountCleared,
    appliedDiscount = 0,
    disabled = false,
}: CoinRedeemWidgetProps) {
    const [balance, setBalance] = useState<CoinBalance | null>(null);
    const [settings, setSettings] = useState<CashbackSettings | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [coinsToUse, setCoinsToUse] = useState(0);
    const [preview, setPreview] = useState<{ discount: number; final: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [applied, setApplied] = useState(false);

    useEffect(() => {
        Promise.all([
            getCoinBalance(customerId),
            getCashbackSettings(),
        ]).then(([bal, cfg]) => {
            setBalance(bal);
            setSettings(cfg);
        }).finally(() => setLoading(false));
    }, [customerId]);

    // Atualizar preview quando coinsToUse muda
    useEffect(() => {
        if (!settings || !coinsToUse) { setPreview(null); return; }
        const maxDiscount = (orderValueBrl * settings.max_redeem_percent) / 100;
        const raw = coinsToUse / settings.coins_to_brl_rate;
        const discount = Math.min(raw, maxDiscount);
        setPreview({ discount: parseFloat(discount.toFixed(2)), final: parseFloat((orderValueBrl - discount).toFixed(2)) });
    }, [coinsToUse, orderValueBrl, settings]);

    const handleApply = async () => {
        if (!settings || !balance || coinsToUse <= 0) return;
        setApplying(true);
        try {
            const validation = await validateCoinRedeem(customerId, coinsToUse, orderValueBrl);
            if (!validation.valid) { alert(validation.error); return; }
            // Não debita aqui — só depois da confirmação da compra (via confirm())
            onDiscountApplied(validation.discount_brl, validation.coins_to_use);
            setApplied(true);
        } finally {
            setApplying(false);
        }
    };

    const handleClear = () => {
        setApplied(false);
        setCoinsToUse(0);
        setPreview(null);
        onDiscountCleared();
    };

    if (loading || !settings?.active || !balance || balance.balance < settings.min_coins_to_redeem) {
        return null; // Não mostrar se inativo, sem saldo ou saldo insuficiente
    }

    const maxCoinsUsable = Math.min(
        balance.balance,
        Math.ceil((orderValueBrl * settings.max_redeem_percent / 100) * settings.coins_to_brl_rate)
    );

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${applied ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200 bg-white'}`}>
            {/* Header */}
            <button
                onClick={() => !applied && setExpanded(e => !e)}
                disabled={disabled || applied}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm font-semibold text-slate-700">Moedas do Vale</span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        {balance.balance.toLocaleString('pt-BR')} moedas
                    </span>
                </div>
                {!applied && (
                    expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
                {applied && (
                    <span className="text-xs text-yellow-700 font-medium">
                        -{coinsToReais(coinsToUse, settings.coins_to_brl_rate).toFixed(2).replace('.', ',')} aplicado
                    </span>
                )}
            </button>

            {/* Aplicado */}
            {applied && (
                <div className="px-4 pb-3 flex items-center justify-between">
                    <p className="text-sm text-yellow-800">
                        ✅ <strong>{coinsToUse} moedas</strong> reduzem R$ {coinsToReais(coinsToUse, settings.coins_to_brl_rate).toFixed(2).replace('.', ',')}
                    </p>
                    <button onClick={handleClear} className="text-xs text-red-500 hover:underline">Remover</button>
                </div>
            )}

            {/* Expansível */}
            {expanded && !applied && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 pt-3">
                        {settings.coins_to_brl_rate} moedas = R$ 1,00 • Máx. {settings.max_redeem_percent}% do pedido
                    </p>

                    {/* Slider / Input */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCoinsToUse(c => Math.max(0, c - 50))}
                                className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50"
                            >
                                <Minus className="w-3 h-3" />
                            </button>
                            <input
                                type="range"
                                min={0}
                                max={maxCoinsUsable}
                                step={50}
                                value={coinsToUse}
                                onChange={e => setCoinsToUse(parseInt(e.target.value))}
                                className="flex-1 accent-yellow-500"
                            />
                            <button
                                onClick={() => setCoinsToUse(c => Math.min(maxCoinsUsable, c + 50))}
                                className="p-1 border border-slate-200 rounded-lg hover:bg-slate-50"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>0 moedas</span>
                            <span className="font-medium text-slate-700">{coinsToUse} moedas selecionadas</span>
                            <button
                                onClick={() => setCoinsToUse(maxCoinsUsable)}
                                className="text-yellow-600 font-medium hover:underline"
                            >
                                Usar tudo ({maxCoinsUsable})
                            </button>
                        </div>
                    </div>

                    {/* Preview */}
                    {preview && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm">
                            <span className="text-yellow-800">
                                Desconto: <strong>-R$ {preview.discount.toFixed(2).replace('.', ',')}</strong>
                                {' '}→ Total: <strong>R$ {preview.final.toFixed(2).replace('.', ',')}</strong>
                            </span>
                        </div>
                    )}

                    <button
                        onClick={handleApply}
                        disabled={applying || coinsToUse <= 0}
                        className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                        {applying ? 'Aplicando...' : 'Aplicar Moedas'}
                    </button>
                </div>
            )}
        </div>
    );
}
