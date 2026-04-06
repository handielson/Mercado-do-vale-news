import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Edit2, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { promotionService, Promotion, PromotionStatus } from '../../../services/promotionService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const PromotionsPage: React.FC = () => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
    const [status, setStatus] = useState<PromotionStatus>('inactive');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        loadPromotions();
    }, []);

    const loadPromotions = async () => {
        try {
            setLoading(true);
            const data = await promotionService.getAllPromotions();
            setPromotions(data);
        } catch (error) {
            console.error('Error loading promotions:', error);
            toast.error('Erro ao carregar promoções');
        } finally {
            setLoading(false);
        }
    };

    const toLocalDatetimeValue = (isoUtc: string): string => {
        const d = new Date(isoUtc);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().substring(0, 16);
    };

    const handleEditClick = (promo: Promotion) => {
        setEditingPromo(promo);
        setStatus(promo.status);
        setStartDate(promo.start_date ? toLocalDatetimeValue(promo.start_date) : '');
        setEndDate(promo.end_date ? toLocalDatetimeValue(promo.end_date) : '');
        setIsModalOpen(true);
    };

    const handeSave = async () => {
        if (!editingPromo) return;

        try {
            if (status === 'scheduled' && (!startDate || !endDate)) {
                toast.error('Promoções agendadas precisam de data de início e fim.');
                return;
            }

            let isoStart = null;
            let isoEnd = null;

            if (status === 'scheduled') {
                if (startDate) {
                    const d = new Date(startDate);
                    if (!isNaN(d.getTime())) isoStart = d.toISOString();
                }
                if (endDate) {
                    const d = new Date(endDate);
                    if (!isNaN(d.getTime())) isoEnd = d.toISOString();
                }
            }

            await promotionService.updatePromotion(editingPromo.id, {
                status,
                start_date: isoStart,
                end_date: isoEnd,
            });

            setIsModalOpen(false);
            await loadPromotions();
            toast.success('Promoção atualizada com sucesso!');
        } catch (error) {
            console.error('Error saving promotion:', error);
            toast.error('Erro ao salvar promoção');
        }
    };

    const getStatusBadge = (promoParams: { status: PromotionStatus, start_date: string | null, end_date: string | null }) => {
        if (promoParams.status === 'active') {
            return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200"><CheckCircle2 size={14} /> Ativa</span>;
        }
        if (promoParams.status === 'inactive') {
            return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200"><XCircle size={14} /> Inativa</span>;
        }

        // Scheduled
        const now = new Date();
        const start = promoParams.start_date ? new Date(promoParams.start_date) : null;
        const end = promoParams.end_date ? new Date(promoParams.end_date) : null;
        const isRunningNow = start && end && now >= start && now <= end;

        return (
            <div className="flex flex-col gap-1">
                <span className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                    <Calendar size={14} /> Agendada
                </span>
                {isRunningNow ? (
                    <span className="text-[10px] text-green-600 font-medium">Rodando agora!</span>
                ) : (
                    start && now < start ? (
                        <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Aguardando início</span>
                    ) : (
                        <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">Expirada</span>
                    )
                )}
            </div>
        );
    };

    return (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">Central de Promoções</span>
                    </h2>
                    <p className="text-slate-500 mt-2">Gerencie as promoções ativas e agendadas do site.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Carregando promoções...</div>
                ) : promotions.length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center text-slate-500">
                        <ShieldAlert size={48} className="text-slate-300 mb-4" />
                        <p className="text-lg font-medium">Nenhuma promoção encontrada.</p>
                        <p className="text-sm">As promoções do sistema não foram inicializadas.</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-4 px-6 font-semibold text-slate-600">Promoção</th>
                                <th className="py-4 px-6 font-semibold text-slate-600 w-48">Status Atual</th>
                                <th className="py-4 px-6 font-semibold text-slate-600 w-48">Período (se agendada)</th>
                                <th className="py-4 px-6 font-semibold text-slate-600 w-24 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {promotions.map(promo => (
                                <tr key={promo.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-6">
                                        <div className="font-bold text-slate-800">{promo.title}</div>
                                        <div className="text-xs text-slate-500 mt-1 max-w-sm line-clamp-2">{promo.description}</div>
                                    </td>
                                    <td className="py-4 px-6">
                                        {getStatusBadge(promo)}
                                    </td>
                                    <td className="py-4 px-6">
                                        {promo.status === 'scheduled' && promo.start_date && promo.end_date ? (
                                            <div className="text-xs text-slate-600 space-y-1">
                                                <div><span className="font-medium">Início:</span> {format(new Date(promo.start_date), "dd/MM/yyyy HH:mm")}</div>
                                                <div><span className="font-medium">Fim:</span> {format(new Date(promo.end_date), "dd/MM/yyyy HH:mm")}</div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">—</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button
                                            onClick={() => handleEditClick(promo)}
                                            className="inline-flex items-center justify-center p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                            title="Configurar"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Modal */}
            {isModalOpen && editingPromo && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Configurar Promoção</h3>
                                <p className="text-xs text-slate-500 mt-1">{editingPromo.title}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Comportamento da Promoção</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setStatus('active')}
                                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${status === 'active' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Sempre Ativa
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStatus('scheduled')}
                                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${status === 'scheduled' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Agendada
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStatus('inactive')}
                                            className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${status === 'inactive' ? 'bg-slate-100 border-slate-400 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Inativa
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {status === 'active' && 'A promoção ficará online imediatamente e os banners aparecerão na loja.'}
                                        {status === 'inactive' && 'A promoção e os banners serão removidos imediatamente da loja.'}
                                        {status === 'scheduled' && 'A promoção só ficará online e valerá durante o período exato abaixo.'}
                                    </p>
                                </div>

                                {status === 'scheduled' && (
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Inicia em:</label>
                                            <input
                                                type="datetime-local"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">Termina em:</label>
                                            <input
                                                type="datetime-local"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handeSave}
                                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-colors"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
