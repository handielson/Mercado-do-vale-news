import React, { useState, useEffect } from 'react';
import { MessageSquareDashed, Filter, Eye, MessageCircle, User, Calendar, CheckCircle2, Clock, Inbox, Reply, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { feedbackService } from '../../../services/feedbackService';
import { CustomerFeedback } from '../../../types/feedback';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const FeedbackListPage: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');

    // Modal State
    const [selectedFeedback, setSelectedFeedback] = useState<CustomerFeedback | null>(null);
    const [adminReply, setAdminReply] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadFeedbacks();
    }, [filterStatus, filterType]);

    const loadFeedbacks = async () => {
        setIsLoading(true);
        try {
            const data = await feedbackService.listFeedbacks({
                status: filterStatus,
                type: filterType
            });
            setFeedbacks(data);
        } catch (error: any) {
            toast.error(error.message || 'Erro ao carregar mensagens.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenFeedback = async (feedback: CustomerFeedback) => {
        setSelectedFeedback(feedback);
        setAdminReply(feedback.admin_reply || '');

        // Se estava 'novo', já marca como 'lido' ao abrir
        if (feedback.status === 'novo') {
            try {
                const updated = await feedbackService.updateFeedback(feedback.id, { status: 'lido' });
                setFeedbacks(prev => prev.map(f => f.id === feedback.id ? updated : f));
                setSelectedFeedback(updated);
            } catch (error) {
                console.error('Erro ao marcar como lido', error);
            }
        }
    };

    const handleSaveReply = async () => {
        if (!selectedFeedback) return;

        setIsSaving(true);
        try {
            const updated = await feedbackService.updateFeedback(selectedFeedback.id, {
                status: 'respondido',
                admin_reply: adminReply
            });
            setFeedbacks(prev => prev.map(f => f.id === selectedFeedback.id ? updated : f));
            setSelectedFeedback(updated);
            toast.success('Resposta/Nota salva com sucesso.');
            setSelectedFeedback(null); // Fechar detalhe
        } catch (error: any) {
            toast.error(error.message || 'Erro ao salvar resposta.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteFeedback = async (id: string) => {
        try {
            await feedbackService.deleteFeedback(id);
            setFeedbacks(prev => prev.filter(f => f.id !== id));
            if (selectedFeedback?.id === id) setSelectedFeedback(null);
            setConfirmDeleteId(null);
            toast.success('Mensagem excluída.');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao excluir mensagem.');
        }
    };

    const handleWhatsAppClick = (contact: string) => {
        // Remove tudo que não for número
        const numbersMatch = contact.match(/\d+/g);
        if (!numbersMatch) {
            toast.error('O contato não parece ser um número de telefone válido.');
            return;
        }

        let phone = numbersMatch.join('');
        // Adiciona 55 se não tiver
        if (phone.length === 10 || phone.length === 11) {
            phone = `55${phone}`;
        }

        window.open(`https://wa.me/${phone}`, '_blank');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'novo':
                return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold flex items-center gap-1"><Inbox size={12} /> Novo</span>;
            case 'lido':
                return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold flex items-center gap-1"><Eye size={12} /> Lido</span>;
            case 'respondido':
                return <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> Respondido</span>;
            default:
                return status;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Dúvida': return 'text-blue-600 bg-blue-50';
            case 'Reclamação': return 'text-red-600 bg-red-50';
            case 'Sugestão': return 'text-emerald-600 bg-emerald-50';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <MessageSquareDashed className="text-blue-600" />
                        Mensagens e Feedbacks
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gerencie dúvidas, sugestões e reclamações enviadas pelos clientes
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-slate-500">
                    <Filter size={18} />
                    <span className="text-sm font-medium">Filtrar por:</span>
                </div>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="all">Todos os Status</option>
                    <option value="novo">Novos</option>
                    <option value="lido">Lidos</option>
                    <option value="respondido">Respondidos</option>
                </select>

                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="all">Todos os Tipos</option>
                    <option value="Dúvida">Dúvidas</option>
                    <option value="Reclamação">Reclamações</option>
                    <option value="Sugestão">Sugestões</option>
                    <option value="Outro">Outros</option>
                </select>
            </div>

            {/* Content Area */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* List */}
                <div className={`basis-full transition-all duration-300 ${selectedFeedback ? 'lg:basis-1/2' : ''}`}>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        {isLoading ? (
                            <div className="p-8 text-center text-slate-500">Carregando mensagens...</div>
                        ) : feedbacks.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Inbox className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">Caixa Vazia</h3>
                                <p className="text-slate-500 text-sm">Nenhuma mensagem encontrada com os filtros atuais.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {feedbacks.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleOpenFeedback(item)}
                                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${selectedFeedback?.id === item.id ? 'bg-blue-50/50' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${getTypeColor(item.type)}`}>
                                                        {item.type}
                                                    </span>
                                                    {!item.customer_name ? (
                                                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Anônimo</span>
                                                    ) : (
                                                        <span className="text-sm font-semibold text-slate-800 truncate">{item.customer_name}</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-600 line-clamp-2 mt-2 leading-relaxed">
                                                    {item.message}
                                                </p>
                                                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={14} />
                                                        {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={14} />
                                                        {format(new Date(item.created_at), "HH:mm")}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                {confirmDeleteId === item.id ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleDeleteFeedback(item.id)}
                                                            className="px-2 py-1 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                        >
                                                            Excluir
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {getStatusBadge(item.status)}
                                                        <button
                                                            onClick={() => setConfirmDeleteId(item.id)}
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Excluir mensagem"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail View */}
                {selectedFeedback && (
                    <div className="basis-full lg:basis-1/2 animate-in slide-in-from-right-4 duration-300">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-lg sticky top-6">
                            <div className="p-6 border-b border-slate-200 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-bold text-slate-900">{selectedFeedback.type}</h3>
                                        {getStatusBadge(selectedFeedback.status)}
                                    </div>
                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                        <Calendar size={14} />
                                        Recebido em {format(new Date(selectedFeedback.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedFeedback(null)}
                                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Sender Info */}
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-start gap-4">
                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm">
                                        <User className="text-slate-400 w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        {selectedFeedback.customer_name ? (
                                            <>
                                                <h4 className="font-semibold text-slate-900">{selectedFeedback.customer_name}</h4>
                                                <p className="text-sm text-slate-600 mt-1">{selectedFeedback.customer_contact}</p>
                                                {selectedFeedback.customer_contact && (
                                                    <button
                                                        onClick={() => handleWhatsAppClick(selectedFeedback.customer_contact!)}
                                                        className="mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-emerald-200"
                                                    >
                                                        <MessageCircle size={14} />
                                                        Tentar no WhatsApp
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <div>
                                                <h4 className="font-semibold text-slate-600 italic">Cliente Anônimo</h4>
                                                <p className="text-xs text-slate-400 mt-1">Este cliente optou por não se identificar.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Message */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Mensagem do Cliente</h4>
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                        {selectedFeedback.message}
                                    </div>
                                </div>

                                {/* Admin Action */}
                                <div className="border-t border-slate-200 pt-6">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Reply size={14} />
                                        Painel de Resolução / Nota Interna
                                    </h4>
                                    <textarea
                                        value={adminReply}
                                        onChange={(e) => setAdminReply(e.target.value)}
                                        placeholder="Adicione notas sobre a resolução dessa mensagem (Ex: Chamado respondido pelo WhatsApp)..."
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                                        rows={4}
                                    />
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={handleSaveReply}
                                            disabled={isSaving}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
                                        >
                                            {isSaving ? 'Salvando...' : 'Salvar Resolução'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
