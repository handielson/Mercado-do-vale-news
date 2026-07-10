import React from 'react';
import { Banknote, Calculator } from 'lucide-react';
import {
    CASH_DENOMINATIONS_CENTS,
    computeDenominationTotalCents,
    formatCashCents,
    type DenominationCount,
} from '../../types/cashRegister';

export type CashCountMode = 'total' | 'count';

interface CashDenominationCounterProps {
    mode: CashCountMode;
    onModeChange: (mode: CashCountMode) => void;
    totalCents: number;
    onTotalCentsChange: (cents: number) => void;
    count: DenominationCount;
    onCountChange: (count: DenominationCount) => void;
    disabled?: boolean;
}

function parseCurrencyToCents(value: string): number {
    const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = Number(normalized || 0);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatCentsForInput(cents: number): string {
    if (!cents) return '';
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function denominationLabel(denom: number): string {
    return denom >= 100
        ? `R$ ${(denom / 100).toLocaleString('pt-BR')}` + (denom >= 200 ? ',00' : ',00')
        : `R$ 0,${String(denom).padStart(2, '0')}`;
}

/**
 * Contagem de dinheiro em especie compartilhada entre abertura e fechamento de caixa.
 * Modo "total": operador digita o valor total direto.
 * Modo "count": operador informa quantidades por denominacao e o total e calculado.
 */
export default function CashDenominationCounter({
    mode,
    onModeChange,
    totalCents,
    onTotalCentsChange,
    count,
    onCountChange,
    disabled = false,
}: CashDenominationCounterProps) {
    const [totalInput, setTotalInput] = React.useState(() => formatCentsForInput(totalCents));

    React.useEffect(() => {
        if (mode === 'total') setTotalInput(formatCentsForInput(totalCents));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const countedTotal = computeDenominationTotalCents(count);
    const effectiveTotal = mode === 'count' ? countedTotal : totalCents;

    const handleQuantityChange = (denom: number, rawValue: string) => {
        const qty = Math.max(0, Math.trunc(Number(rawValue.replace(/\D/g, '') || 0)));
        const next: DenominationCount = { ...count };
        if (qty > 0) next[String(denom)] = qty;
        else delete next[String(denom)];
        onCountChange(next);
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onModeChange('total')}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        mode === 'total'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Banknote size={16} />
                    Valor total
                </button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onModeChange('count')}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        mode === 'count'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Calculator size={16} />
                    Contar notas e moedas
                </button>
            </div>

            {mode === 'total' ? (
                <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Valor em espécie (R$)</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={totalInput}
                        disabled={disabled}
                        onChange={(e) => {
                            setTotalInput(e.target.value);
                            onTotalCentsChange(parseCurrencyToCents(e.target.value));
                        }}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                </div>
            ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {CASH_DENOMINATIONS_CENTS.map((denom) => {
                        const qty = count[String(denom)] || 0;
                        const lineTotal = qty * denom;
                        return (
                            <div key={denom} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
                                <span className="w-20 shrink-0 text-sm font-semibold text-slate-700">
                                    {denominationLabel(denom)}
                                </span>
                                <span className="text-xs text-slate-400">{denom >= 200 ? 'nota' : denom === 100 ? 'nota/moeda' : 'moeda'}</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={qty || ''}
                                    disabled={disabled}
                                    onChange={(e) => handleQuantityChange(denom, e.target.value)}
                                    placeholder="0"
                                    className="ml-auto w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm font-semibold focus:border-emerald-500 focus:outline-none"
                                />
                                <span className="w-24 shrink-0 text-right font-mono text-xs text-slate-500">
                                    {lineTotal > 0 ? formatCashCents(lineTotal) : '—'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3 text-white">
                <span className="text-sm font-medium">Total encontrado</span>
                <span className="font-mono text-xl font-bold">{formatCashCents(effectiveTotal)}</span>
            </div>
        </div>
    );
}
