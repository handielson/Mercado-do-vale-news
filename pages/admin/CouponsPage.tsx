import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Ticket } from 'lucide-react';
import { listCoupons, updateCoupon, deleteCoupon, type Coupon } from '../../services/couponService';
import { CouponFormModal } from '../../components/admin/CouponFormModal';
import toast from 'react-hot-toast';

const TARGET_LABELS: Record<string, string> = {
    all: 'Todos',
    varejo: 'Varejo',
    atacado: 'Atacado',
    revenda: 'Revenda',
    ADMIN: 'Admin',
};

function getCouponStatus(c: Coupon): { label: string; color: string } {
    if (!c.active) return { label: 'Inativo', color: 'bg-slate-100 text-slate-600' };
    if (c.expires_at && new Date(c.expires_at) < new Date()) return { label: 'Expirado', color: 'bg-red-100 text-red-700' };
    if (c.max_uses !== null && c.uses_count >= c.max_uses) return { label: 'Esgotado', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Ativo', color: 'bg-green-100 text-green-700' };
}

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Coupon | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            setCoupons(await listCoupons());
        } catch {
            toast.error('Erro ao carregar cupons');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleToggleActive = async (coupon: Coupon) => {
        try {
            await updateCoupon(coupon.id, { active: !coupon.active });
            toast.success(coupon.active ? 'Cupom desativado' : 'Cupom ativado');
            load();
        } catch {
            toast.error('Erro ao atualizar cupom');
        }
    };

    const handleDelete = async (coupon: Coupon) => {
        if (!confirm(`Excluir cupom "${coupon.code}"?`)) return;
        try {
            await deleteCoupon(coupon.id);
            toast.success('Cupom excluído');
            load();
        } catch {
            toast.error('Erro ao excluir cupom');
        }
    };

    const handleSaved = () => {
        setModalOpen(false);
        setEditing(null);
        load();
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                        <Ticket className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Cupons de Desconto</h1>
                        <p className="text-sm text-slate-500">{coupons.length} cupons cadastrados</p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditing(null); setModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow"
                >
                    <Plus className="w-4 h-4" />
                    Novo Cupom
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">Carregando...</div>
                ) : coupons.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum cupom cadastrado.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Código</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Desconto</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Público</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Usos</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Validade</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {coupons.map(c => {
                                const status = getCouponStatus(c);
                                return (
                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{c.code}</span>
                                            {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-blue-600">
                                            {c.type === 'percent' ? `${c.value}%` : `R$ ${c.value.toFixed(2).replace('.', ',')}`}
                                            {c.min_order > 0 && (
                                                <p className="text-xs text-slate-400 font-normal">Mín. R$ {c.min_order.toFixed(2).replace('.', ',')}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{TARGET_LABELS[c.target_type]}</td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c.uses_count}{c.max_uses !== null ? ` / ${c.max_uses}` : ''}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {c.expires_at
                                                ? new Date(c.expires_at).toLocaleDateString('pt-BR')
                                                : <span className="text-slate-400">Sem validade</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => handleToggleActive(c)}
                                                    title={c.active ? 'Desativar' : 'Ativar'}
                                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors"
                                                >
                                                    {c.active ? <ToggleRight className="w-5 h-5 text-green-600" /> : <ToggleLeft className="w-5 h-5" />}
                                                </button>
                                                <button
                                                    onClick={() => { setEditing(c); setModalOpen(true); }}
                                                    title="Editar"
                                                    className="p-1.5 hover:bg-blue-50 rounded text-slate-500 hover:text-blue-600 transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c)}
                                                    title="Excluir"
                                                    className="p-1.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {modalOpen && (
                <CouponFormModal
                    initial={editing}
                    onClose={() => { setModalOpen(false); setEditing(null); }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}
