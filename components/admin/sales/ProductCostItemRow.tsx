import React, { useState } from 'react';
import { Check, Lock, Pencil, RefreshCw, X } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { updateProductManualCost, type MarketplaceFinancialCostItem } from '../../../services/adminMarketplaceSalesService';

interface Props {
    item: MarketplaceFinancialCostItem;
    context: string;
    onSaved: () => void;
}

function money(cents: number | null | undefined): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}

/** De onde veio o custo atual do produto. */
export function costBasisLabel(basis: string | null | undefined): string {
    if (basis === 'manual_operator') return 'ajustado manualmente';
    if (basis === 'weighted_acquisition_with_expenses') return 'média de compra conferida';
    return 'origem não registrada (cadastro/Bling antigo)';
}

export function ProductCostItemRow({ item, context, onSaved }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState<number>(item.current_cost_cents ?? 0);
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const startEditing = () => {
        setValue(item.current_cost_cents ?? 0);
        setNote('');
        setError('');
        setIsEditing(true);
    };

    const save = async () => {
        if (!item.product_id) return;
        setIsSaving(true);
        setError('');
        try {
            await updateProductManualCost(item.product_id, {
                cost_cents: Math.max(0, Math.round(Number(value) || 0)),
                expected_cost_cents: item.current_cost_cents ?? null,
                note: note.trim() || undefined,
                context,
            });
            setIsEditing(false);
            onSaved();
        } catch (saveError: any) {
            setError(saveError?.message || 'Não foi possível salvar o custo.');
        } finally {
            setIsSaving(false);
        }
    };

    const matchLabel = item.matched_by === 'shopee_link' ? 'vínculo do anúncio' : item.matched_by === 'sku' ? 'pelo SKU' : 'produto não encontrado';

    return (
        <div className="p-3">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="truncate text-slate-700" title={item.name}>{item.name}</p>
                    <p className="text-xs text-slate-500">
                        {item.quantity} × {item.unit_cost_cents > 0 ? money(item.unit_cost_cents) : 'sem custo'} · {matchLabel}
                    </p>
                    {item.product_id && (
                        <p className="text-[11px] text-slate-400">Custo {costBasisLabel(item.cost_basis)}</p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <p className="whitespace-nowrap font-medium text-slate-800">{money(item.total_cost_cents)}</p>
                    {item.product_id && item.cost_editable && !isEditing && (
                        <button
                            type="button"
                            onClick={startEditing}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            aria-label={`Alterar custo de ${item.name}`}
                        >
                            <Pencil size={12} /> Alterar custo
                        </button>
                    )}
                </div>
            </div>

            {item.product_id && !item.cost_editable && item.cost_lock_reason && (
                <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500"><Lock size={12} className="mt-0.5 shrink-0" />{item.cost_lock_reason}</p>
            )}

            {isEditing && (
                <div className="mt-3 space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                    <p className="text-xs text-slate-600">
                        Custo de compra por unidade do produto <strong>{item.product_name || item.name}</strong>. Vale para as próximas vendas e para os cálculos de lucro; vendas já registradas no PDV não mudam.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
                        <CurrencyInput value={value} onChange={setValue} placeholder="R$ 0,00" />
                        <input
                            type="text"
                            value={note}
                            maxLength={300}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Motivo (opcional): ex. nota de compra 123"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                    </div>
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsEditing(false)} disabled={isSaving} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                            <X size={12} /> Cancelar
                        </button>
                        <button type="button" onClick={() => void save()} disabled={isSaving} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                            {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />} Salvar custo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
