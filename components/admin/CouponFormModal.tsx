import { useState, useEffect } from 'react';
import { X, Ticket } from 'lucide-react';
import { createCoupon, updateCoupon, type Coupon } from '../../services/couponService';
import toast from 'react-hot-toast';

interface Props {
    initial: Coupon | null;
    onClose: () => void;
    onSaved: () => void;
}

const EMPTY: Omit<Coupon, 'id' | 'uses_count' | 'created_at'> = {
    code: '',
    description: '',
    type: 'percent',
    value: 10,
    min_order: 0,
    max_uses: null,
    expires_at: null,
    active: true,
    target_type: 'all',
};

export function CouponFormModal({ initial, onClose, onSaved }: Props) {
    const [form, setForm] = useState<typeof EMPTY>(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (initial) {
            setForm({
                code: initial.code,
                description: initial.description ?? '',
                type: initial.type,
                value: initial.value,
                min_order: initial.min_order,
                max_uses: initial.max_uses,
                expires_at: initial.expires_at
                    ? initial.expires_at.slice(0, 10) // yyyy-mm-dd for input[type=date]
                    : null,
                active: initial.active,
                target_type: initial.target_type,
            });
        } else {
            setForm(EMPTY);
        }
    }, [initial]);

    const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) =>
        setForm(prev => ({ ...prev, [k]: v }));

    // Live discount preview
    const previewBase = 1000;
    const previewDiscount = form.type === 'percent'
        ? (previewBase * form.value) / 100
        : Math.min(form.value, previewBase);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.code.trim()) { toast.error('Informe o código'); return; }
        if (form.value <= 0) { toast.error('Valor inválido'); return; }
        if (form.type === 'percent' && form.value > 100) { toast.error('Percentual deve ser entre 1 e 100'); return; }

        setSaving(true);
        try {
            const payload = {
                ...form,
                code: form.code.toUpperCase().trim(),
                description: form.description || null,
                expires_at: form.expires_at || null,
            };

            if (initial) {
                await updateCoupon(initial.id, payload);
                toast.success('Cupom atualizado!');
            } else {
                await createCoupon(payload);
                toast.success('Cupom criado!');
            }
            onSaved();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            toast.error(msg.includes('unique') ? 'Código já existe' : 'Erro ao salvar cupom');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-bold text-slate-900">
                            {initial ? 'Editar Cupom' : 'Novo Cupom'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Code */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Código *</label>
                        <input
                            value={form.code}
                            onChange={e => set('code', e.target.value.toUpperCase())}
                            placeholder="EX: VALE10"
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none font-mono uppercase"
                            maxLength={30}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                        <input
                            value={form.description ?? ''}
                            onChange={e => set('description', e.target.value)}
                            placeholder="Use interna (não exibida ao cliente)"
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Type + Value */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                            <select
                                value={form.type}
                                onChange={e => set('type', e.target.value as 'percent' | 'fixed')}
                                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                            >
                                <option value="percent">Percentual (%)</option>
                                <option value="fixed">Valor fixo (R$)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Valor * {form.type === 'percent' ? '(%)' : '(R$)'}
                            </label>
                            <input
                                type="number"
                                min={0.01}
                                max={form.type === 'percent' ? 100 : undefined}
                                step={0.01}
                                value={form.value}
                                onChange={e => set('value', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                        📋 <strong>Preview:</strong> em um pedido de R$ 1.000,00 o desconto seria{' '}
                        <strong>R$ {previewDiscount.toFixed(2).replace('.', ',')}</strong>
                        {' '}→ total R$ {(previewBase - previewDiscount).toFixed(2).replace('.', ',')}
                    </div>

                    {/* Target type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Público-alvo</label>
                        <select
                            value={form.target_type}
                            onChange={e => set('target_type', e.target.value as Coupon['target_type'])}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                        >
                            <option value="all">Todos os clientes</option>
                            <option value="varejo">Apenas Varejo</option>
                            <option value="atacado">Apenas Atacado</option>
                            <option value="revenda">Apenas Revenda</option>
                            <option value="ADMIN">Apenas Admin (PDV)</option>
                        </select>
                    </div>

                    {/* Min order + Max uses */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Pedido mínimo (R$)</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={form.min_order}
                                onChange={e => set('min_order', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Limite de usos</label>
                            <input
                                type="number"
                                min={1}
                                value={form.max_uses ?? ''}
                                placeholder="Ilimitado"
                                onChange={e => set('max_uses', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Expiry */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Validade (opcional)</label>
                        <input
                            type="date"
                            value={form.expires_at ?? ''}
                            onChange={e => set('expires_at', e.target.value || null)}
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Active toggle */}
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div
                            onClick={() => set('active', !form.active)}
                            className={`w-12 h-6 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-slate-300'} flex items-center px-1 cursor-pointer`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                            {form.active ? 'Ativo' : 'Inativo'}
                        </span>
                    </label>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border-2 border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Salvando...' : initial ? 'Salvar Alterações' : 'Criar Cupom'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
