import React, { useState } from 'react';
import { Check, Lock, Pencil, RefreshCw, X } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { updateProductManualCost } from '../../../services/adminMarketplaceSalesService';
import { vpsApiService } from '../../../services/vpsApiService';
import { moneyToCents } from '../../../utils/money';

// sale-item-cost-edit-v1: corrigir o custo de um item direto na venda do PDV.
// Não existe "custo só desta venda": ao abrir, a venda recalcula o custo a partir do produto
// (ou da média móvel do aparelho). Por isso o ajuste vai para a fonte — o custo do produto,
// pela mesma rota auditada do financeiro dos marketplaces — e depois a venda é recalculada.

interface Props {
    productId?: string | null;
    productName: string;
    serialized: boolean;
    onSaved: (newCostCents: number) => Promise<void> | void;
}

export function SaleItemCostEditor({ productId, productName, serialized, onSaved }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [expected, setExpected] = useState<number | null>(null);
    const [value, setValue] = useState(0);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    if (!productId) return null;
    if (serialized) {
        return (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-400">
                <Lock size={11} className="mt-0.5 shrink-0" />
                Aparelho com IMEI: o custo vem da compra da unidade / média da versão (Página do Produto).
            </p>
        );
    }

    const start = async () => {
        setIsLoading(true);
        setError('');
        try {
            const [product] = (await vpsApiService.getProductsByIds([productId])) || [];
            if (!product) throw new Error('Produto não encontrado.');
            const current = product.price_cost == null || product.price_cost === '' ? null : moneyToCents(product.price_cost);
            setExpected(current);
            setValue(current ?? 0);
            setNote('');
            setIsEditing(true);
        } catch (loadError: any) {
            setError(loadError?.message || 'Não foi possível carregar o custo do produto.');
        } finally {
            setIsLoading(false);
        }
    };

    const save = async () => {
        const costCents = Math.max(0, Math.round(Number(value) || 0));
        setIsSaving(true);
        setError('');
        try {
            await updateProductManualCost(productId, {
                cost_cents: costCents,
                expected_cost_cents: expected,
                note: note.trim() || undefined,
                context: 'pdv_sale_detail',
            });
            setIsEditing(false);
            await onSaved(costCents);
        } catch (saveError: any) {
            setError(saveError?.message || 'Não foi possível salvar o custo.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isEditing) {
        return (
            <div className="mt-1">
                <button
                    type="button"
                    onClick={() => void start()}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    aria-label={`Alterar custo de ${productName}`}
                >
                    {isLoading ? <RefreshCw size={11} className="animate-spin" /> : <Pencil size={11} />} Alterar custo
                </button>
                {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
            </div>
        );
    }

    return (
        <div className="mt-2 space-y-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <p className="text-[11px] text-slate-600">
                Custo de compra por unidade de <strong>{productName}</strong>. Altera o custo do produto (vale para as próximas vendas) e recalcula o lucro desta venda.
            </p>
            <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
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
            {error && <p className="text-[11px] text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditing(false)} disabled={isSaving} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                    <X size={12} /> Cancelar
                </button>
                <button type="button" onClick={() => void save()} disabled={isSaving} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />} Salvar e recalcular
                </button>
            </div>
        </div>
    );
}
