import React, { useState, useEffect } from 'react';
import { CreditCard, Save, AlertCircle } from 'lucide-react';
import { paymentFeesService } from '../../../services/payment-fees';
import { PaymentFee } from '../../../types/payment-fees';
import { toast } from 'sonner';

export function PaymentFeesPage() {
    const [fees, setFees] = useState<PaymentFee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editedFees, setEditedFees] = useState<Map<string, PaymentFee>>(new Map());

    useEffect(() => {
        loadFees();
    }, []);

    async function loadFees() {
        try {
            await paymentFeesService.initializeDefaults();
            const data = await paymentFeesService.list();
            setFees(data);
        } catch (error) {
            console.error('Error loading fees:', error);
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
                    applied_fee: fee.applied_fee
                });
            }
            toast.success('Taxas atualizadas com sucesso!');
            setEditedFees(new Map());
            await loadFees();
        } catch (error) {
            console.error('Error saving fees:', error);
            toast.error('Erro ao salvar taxas');
        } finally {
            setSaving(false);
        }
    }

    function updateFee(id: string, field: 'operator_name' | 'operator_fee' | 'applied_fee', value: string | number) {
        const fee = fees.find(f => f.id === id);
        if (!fee) return;

        const updated = { ...fee, [field]: value };

        // Validation: applied_fee must be >= operator_fee (only for numeric fields)
        if (field !== 'operator_name' && updated.applied_fee < updated.operator_fee) {
            toast.error('Taxa aplicada deve ser maior ou igual à taxa operadora');
            return;
        }

        const newEdited = new Map(editedFees);
        newEdited.set(id, updated);
        setEditedFees(newEdited);
    }

    function getDisplayName(method: string, installments: number): string {
        if (method === 'debit') return 'Débito';
        if (method === 'pix') return 'PIX';
        return `${installments}x`;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard className="text-blue-600" />
                        Taxas de Pagamento
                    </h1>
                    <p className="text-slate-600 mt-1">
                        Configure as taxas reais e aplicadas para cada forma de pagamento
                    </p>
                </div>
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                    <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                    <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">Como funciona:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800">
                            <li><strong>Operadora:</strong> Nome da empresa que processa o pagamento (ex: PagSeguro, Mercado Pago)</li>
                            <li><strong>Taxa Operadora:</strong> Taxa real cobrada pela operadora (para relatórios precisos)</li>
                            <li><strong>Taxa Aplicada:</strong> Taxa repassada ao cliente (sempre ≥ taxa operadora)</li>
                        </ul>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-600">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Carregando taxas...
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Nº de Parcelas</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Operadora</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Taxa Operadora (%)</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Taxa Aplicada (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {fees.map(fee => {
                                    const edited = editedFees.get(fee.id) || fee;
                                    const hasChanges = editedFees.has(fee.id);

                                    return (
                                        <tr key={fee.id} className={hasChanges ? 'bg-yellow-50' : 'hover:bg-slate-50 transition-colors'}>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                                {getDisplayName(fee.payment_method, fee.installments)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={edited.operator_name || ''}
                                                    onChange={(e) => updateFee(fee.id, 'operator_name', e.target.value)}
                                                    placeholder="Ex: PagSeguro"
                                                    className="w-40 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={edited.operator_fee}
                                                    onChange={(e) => updateFee(fee.id, 'operator_fee', parseFloat(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={edited.applied_fee}
                                                    onChange={(e) => updateFee(fee.id, 'applied_fee', parseFloat(e.target.value) || 0)}
                                                    className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
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
