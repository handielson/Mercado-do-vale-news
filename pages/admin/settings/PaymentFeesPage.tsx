import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, Save, AlertCircle, RefreshCw, ExternalLink, Wifi, Store } from 'lucide-react';
import { paymentFeesService } from '../../../services/payment-fees';
import { paymentIntegrationService } from '../../../services/paymentIntegrationService';
import { PaymentFee } from '../../../types/payment-fees';
import { toast } from 'sonner';

const REFERENCE_BIN = '411111';
const REFERENCE_AMOUNT = 1000;

type FeeKey = string; // `${payment_method}_${installments}`

interface FeeRow {
    method: string;
    installments: number;
    label: string;
    presencial?: PaymentFee;
    online_mp?: PaymentFee;
    online_ps?: PaymentFee;
}

export function PaymentFeesPage() {
    const [fees, setFees] = useState<PaymentFee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [editedFees, setEditedFees] = useState<Map<string, PaymentFee>>(new Map());

    useEffect(() => {
        loadFees();
    }, []);

    const rows = useMemo<FeeRow[]>(() => {
        const map = new Map<FeeKey, FeeRow>();

        for (const fee of fees) {
            const key: FeeKey = `${fee.payment_method}_${fee.installments}`;
            if (!map.has(key)) {
                map.set(key, {
                    method: fee.payment_method,
                    installments: fee.installments,
                    label: getDisplayName(fee.payment_method, fee.installments),
                });
            }
            const row = map.get(key)!;
            if (fee.channel === 'presencial') row.presencial = fee;
            else if (fee.channel === 'online_mp') row.online_mp = fee;
            else if (fee.channel === 'online_ps') row.online_ps = fee;
        }

        const methodOrder: Record<string, number> = { pix: 0, debit: 1, credit: 2 };
        return Array.from(map.values()).sort((a, b) => {
            const mo = (methodOrder[a.method] ?? 3) - (methodOrder[b.method] ?? 3);
            return mo !== 0 ? mo : a.installments - b.installments;
        });
    }, [fees]);

    async function syncFromMercadoPago() {
        setSyncing(true);
        try {
            const integrations = await paymentIntegrationService.getIntegrations();
            const mpIntegration =
                integrations.find((g: any) => g.is_active && g.public_key && g.provider_name?.toLowerCase().includes('mercado')) ||
                integrations.find((g: any) => g.is_active && g.public_key);

            if (!mpIntegration?.public_key) {
                toast.error('Public Key do Mercado Pago não encontrada. Configure em Integrações de Pagamento.');
                return;
            }

            const url = `https://api.mercadopago.com/v1/payment_methods/installments?public_key=${mpIntegration.public_key}&payment_method_id=visa&amount=${REFERENCE_AMOUNT}&bin=${REFERENCE_BIN}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Erro ao consultar MP: ${res.status}`);

            const data = await res.json();
            const installmentOptions: { installments: number; installment_rate: number }[] = data?.[0]?.payer_costs ?? [];

            if (!installmentOptions.length) {
                toast.error('Nenhuma taxa retornada pelo Mercado Pago. Verifique a Public Key.');
                return;
            }

            const currentFees: PaymentFee[] = await paymentFeesService.list();
            let updated = 0;

            for (const option of installmentOptions) {
                const match = currentFees.find(
                    f => f.payment_method === 'credit' && f.installments === option.installments && f.channel === 'online_mp'
                );
                if (match) {
                    await paymentFeesService.update(match.id, {
                        operator_name: 'Mercado Pago',
                        operator_fee: option.installment_rate,
                        applied_fee: option.installment_rate,
                    });
                    updated++;
                }
            }

            toast.success(`${updated} taxas MP sincronizadas!`);
            await loadFees();
        } catch (error: any) {
            toast.error('Erro ao sincronizar: ' + (error.message || 'Tente novamente'));
        } finally {
            setSyncing(false);
        }
    }

    async function loadFees() {
        try {
            await paymentFeesService.initializeDefaults();
            const data = await paymentFeesService.list();
            setFees(data);
        } catch (error) {
            toast.error('Erro ao carregar taxas');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            for (const [id, fee] of editedFees) {
                await paymentFeesService.update(id, {
                    operator_name: fee.operator_name,
                    operator_fee: fee.operator_fee,
                    applied_fee: fee.applied_fee,
                });
            }
            toast.success('Taxas atualizadas com sucesso!');
            setEditedFees(new Map());
            await loadFees();
        } catch (error) {
            toast.error('Erro ao salvar taxas');
        } finally {
            setSaving(false);
        }
    }

    function updateFee(fee: PaymentFee, field: 'operator_name' | 'operator_fee' | 'applied_fee', value: string | number) {
        const updated = { ...fee, [field]: value };
        if (field !== 'operator_name' && updated.applied_fee < updated.operator_fee) {
            toast.error('Taxa aplicada deve ser maior ou igual à taxa operadora');
            return;
        }
        const newEdited = new Map(editedFees);
        newEdited.set(fee.id, updated);
        setEditedFees(newEdited);
    }

    function getEdited(fee?: PaymentFee): PaymentFee | undefined {
        if (!fee) return undefined;
        return editedFees.get(fee.id) || fee;
    }

    function isChanged(fee?: PaymentFee) {
        return fee ? editedFees.has(fee.id) : false;
    }

    // Shared input styles
    const inputBase = 'px-2 py-1 text-sm border border-slate-300 rounded outline-none';
    const focusAmber = 'focus:ring-2 focus:ring-amber-400';
    const focusBlue = 'focus:ring-2 focus:ring-blue-400';
    const focusGreen = 'focus:ring-2 focus:ring-green-400';

    return (
        <div className="p-6 max-w-full mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard className="text-blue-600" />
                        Taxas de Pagamento
                    </h1>
                    <p className="text-slate-600 mt-1">
                        Compare e configure as taxas presencial e online por forma de pagamento
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={syncFromMercadoPago}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-[#009ee3] text-white rounded-lg hover:bg-[#0080c0] disabled:opacity-50 transition-colors"
                        title="Importa taxas de referência do Mercado Pago"
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Sync MP'}
                    </button>

                    {editedFees.size > 0 && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <Save size={18} />
                            {saving ? 'Salvando...' : `Salvar (${editedFees.size})`}
                        </button>
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-900">
                <div className="flex items-start gap-2">
                    <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                        <li><strong>Presencial:</strong> PagSeguro maquininha — editável, até 18x</li>
                        <li><strong>Mercado Pago Online:</strong> Apenas referência/comparação — não usada nos cálculos</li>
                        <li><strong>PagSeguro Online:</strong> Taxas do checkout online — editável, até 12x</li>
                    </ul>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-600">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                    Carregando taxas...
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                {/* Group header */}
                                <tr className="border-b border-slate-200">
                                    <th className="px-4 py-2 text-left text-slate-500 font-medium bg-slate-50" rowSpan={2}>
                                        Parcelas
                                    </th>
                                    {/* Presencial */}
                                    <th colSpan={3} className="px-3 py-2 text-center font-semibold bg-amber-50 border-l border-slate-200">
                                        <span className="flex items-center justify-center gap-1.5 text-amber-700">
                                            <Store size={13} /> Presencial
                                        </span>
                                    </th>
                                    {/* MP Online */}
                                    <th colSpan={1} className="px-3 py-2 text-center font-semibold bg-sky-50 border-l border-slate-200">
                                        <span className="flex items-center justify-center gap-1.5 text-sky-700">
                                            <Wifi size={13} /> Mercado Pago Online
                                        </span>
                                    </th>
                                    {/* PS Online */}
                                    <th colSpan={1} className="px-3 py-2 text-center font-semibold bg-green-50 border-l border-slate-200">
                                        <span className="flex items-center justify-center gap-1.5 text-green-700">
                                            <Wifi size={13} /> PagSeguro Online
                                        </span>
                                    </th>
                                </tr>
                                {/* Sub-headers */}
                                <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                                    {/* Presencial */}
                                    <th className="px-3 py-2 text-left bg-amber-50 border-l border-slate-200">Operadora</th>
                                    <th className="px-3 py-2 text-left bg-amber-50">Taxa Op. %</th>
                                    <th className="px-3 py-2 text-left bg-amber-50">Taxa Aplic. %</th>
                                    {/* MP Online */}
                                    <th className="px-3 py-2 text-left bg-sky-50 border-l border-slate-200">Taxa Op. %</th>
                                    {/* PS Online */}
                                    <th className="px-3 py-2 text-left bg-green-50 border-l border-slate-200">Taxa Op. %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map(row => {
                                    const pres = getEdited(row.presencial);
                                    const mp = getEdited(row.online_mp);
                                    const ps = getEdited(row.online_ps);
                                    const changed = isChanged(row.presencial) || isChanged(row.online_mp) || isChanged(row.online_ps);

                                    return (
                                        <tr
                                            key={`${row.method}_${row.installments}`}
                                            className={changed ? 'bg-yellow-50' : 'hover:bg-slate-50 transition-colors'}
                                        >
                                            {/* Label */}
                                            <td className="px-4 py-2 font-medium text-slate-700">{row.label}</td>

                                            {/* ── Presencial ── */}
                                            <td className="px-3 py-2 border-l border-slate-100">
                                                {pres
                                                    ? <input type="text" value={pres.operator_name || ''} onChange={e => updateFee(row.presencial!, 'operator_name', e.target.value)} placeholder="Ex: PagSeguro" className={`w-28 ${inputBase} ${focusAmber}`} />
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                                {pres
                                                    ? <input type="number" step="0.01" min="0" max="100" value={pres.operator_fee} onChange={e => updateFee(row.presencial!, 'operator_fee', parseFloat(e.target.value) || 0)} className={`w-18 ${inputBase} ${focusAmber}`} />
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                                {pres
                                                    ? <input type="number" step="0.01" min="0" max="100" value={pres.applied_fee} onChange={e => updateFee(row.presencial!, 'applied_fee', parseFloat(e.target.value) || 0)} className={`w-18 ${inputBase} ${focusAmber}`} />
                                                    : <span className="text-slate-300">—</span>}
                                            </td>

                                            {/* ── MP Online — editável ── */}
                                            <td className="px-3 py-2 border-l border-slate-100 bg-sky-50/40">
                                                {mp
                                                    ? <input type="number" step="0.01" min="0" max="100" value={mp.operator_fee} onChange={e => updateFee(row.online_mp!, 'operator_fee', parseFloat(e.target.value) || 0)} className={`w-18 ${inputBase} ${focusBlue}`} />
                                                    : <span className="text-slate-300">—</span>}
                                            </td>

                                            {/* ── PS Online ── */}
                                            <td className="px-3 py-2 border-l border-slate-100">
                                                {ps
                                                    ? <input type="number" step="0.01" min="0" max="100" value={ps.operator_fee} onChange={e => updateFee(row.online_ps!, 'operator_fee', parseFloat(e.target.value) || 0)} className={`w-18 ${inputBase} ${focusGreen}`} />
                                                    : <span className="text-slate-300">—</span>}
                                            </td>

                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function getDisplayName(method: string, installments: number): string {
    if (method === 'debit') return 'Débito';
    if (method === 'pix') return 'PIX';
    return `${installments}x`;
}
