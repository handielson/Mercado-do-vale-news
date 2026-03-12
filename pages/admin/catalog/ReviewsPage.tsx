import React, { useState, useEffect } from 'react';
import { Star, Filter, EyeOff, CheckCircle, MessageSquare, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { reviewService } from '../../../services/reviews';
import { ProductReview } from '../../../types/review';
import { supabase } from '../../../services/supabase';

export const ReviewsPage: React.FC = () => {
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'hidden'>('all');
    
    // Reply Modal state
    const [replyingTo, setReplyingTo] = useState<ProductReview | null>(null);
    const [replyText, setReplyText] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, [filter]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const data = await reviewService.getAdminReviews(filter === 'all' ? undefined : filter);
            setReviews(data);
        } catch (error) {
            console.error('Erro ao buscar avaliações:', error);
            toast.error('Não foi possível carregar as avaliações.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: 'approved' | 'hidden') => {
        try {
            await reviewService.updateReviewStatus(id, status);
            toast.success(`Avaliação ${status === 'approved' ? 'Aprovada' : 'Ocultada'} com sucesso!`);
            fetchReviews();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao atualizar status da avaliação.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja apagar esta avaliação permanentemente?')) return;
        try {
            const { error } = await supabase.from('product_reviews').delete().eq('id', id);
            if (error) throw error;
            toast.success('Avaliação apagada!');
            fetchReviews();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao apagar avaliação.');
        }
    };

    const handleSendReply = async () => {
        if (!replyingTo || !replyText.trim()) return;
        try {
            setSubmittingReply(true);
            await reviewService.replyToReview(replyingTo.id, replyText);
            toast.success('Resposta enviada!');
            setReplyingTo(null);
            setReplyText('');
            fetchReviews();
        } catch (error) {
            toast.error('Erro ao enviar resposta.');
        } finally {
            setSubmittingReply(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Star className="text-yellow-500 fill-yellow-500" />
                        Moderação de Avaliações
                    </h1>
                    <p className="text-slate-600 mt-1">Aprove depoimentos e recompense usuários com Moedas do Vale.</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    {(['all', 'pending', 'approved', 'hidden'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                filter === f 
                                ? 'bg-blue-50 text-blue-700' 
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {f === 'all' && 'Todas'}
                            {f === 'pending' && 'Pendentes'}
                            {f === 'approved' && 'Aprovadas'}
                            {f === 'hidden' && 'Ocultas'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-200">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Nenhuma avaliação encontrada nesta categoria.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                    {reviews.map(review => (
                        <div key={review.id} className="p-5 hover:bg-slate-50 transition-colors">
                            <div className="flex flex-col md:flex-row gap-5">
                                {/* Info Sidebar */}
                                <div className="w-full md:w-64 shrink-0 flex flex-col gap-2 border-r border-slate-100 pr-4">
                                    <div className="flex items-center gap-3">
                                        {review.customer?.avatar_url ? (
                                            <img src={review.customer.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold border border-slate-200">
                                                {review.customer?.name?.[0]?.toUpperCase() || 'C'}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-800 text-sm truncate">{review.customer?.name || 'Cliente Oculto'}</p>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1
                                                ${review.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                  review.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                  'bg-slate-100 text-slate-600'}
                                            `}>
                                                {review.status === 'pending' ? 'Pendente' : review.status === 'approved' ? 'Pública' : 'Oculta'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 mt-2">ID Produto: {review.product_id.split('-')[0]}...</span>
                                    <span className="text-xs text-slate-400">{new Date(review.created_at).toLocaleString('pt-BR')}</span>
                                </div>

                                {/* Review Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex mb-2">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 fill-slate-200'}`} />
                                        ))}
                                    </div>
                                    <p className="text-slate-700 text-sm whitespace-pre-wrap">{review.review_text || '(Avaliação sem comentário texto)'}</p>
                                    
                                    {review.admin_reply && (
                                        <div className="mt-4 bg-blue-50 p-3 rounded-lg border-l-2 border-blue-400">
                                            <p className="text-xs font-bold text-blue-800 mb-1">Sua Resposta Oficial:</p>
                                            <p className="text-sm text-slate-700">{review.admin_reply}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 md:w-32 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
                                    {review.status !== 'approved' && (
                                        <button onClick={() => handleUpdateStatus(review.id, 'approved')} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold transition-colors">
                                            <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                                        </button>
                                    )}
                                    {review.status !== 'hidden' && (
                                        <button onClick={() => handleUpdateStatus(review.id, 'hidden')} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded text-xs font-semibold transition-colors">
                                            <EyeOff className="w-3.5 h-3.5" /> Ocultar
                                        </button>
                                    )}
                                    <button onClick={() => setReplyingTo(review)} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-semibold transition-colors">
                                        <MessageSquare className="w-3.5 h-3.5" /> Responder
                                    </button>
                                    <button onClick={() => handleDelete(review.id)} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded text-xs font-semibold transition-colors mt-auto">
                                        <Trash2 className="w-3.5 h-3.5" /> Apagar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Resposta */}
            {replyingTo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Responder à Avaliação</h3>
                            <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-slate-600"><Trash2 className="hidden" /> Fechar</button>
                        </div>
                        <div className="p-6">
                            <div className="mb-4 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                "{replyingTo.review_text}"
                            </div>
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Escreva sua resposta (ficará visível para outros clientes)..."
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                rows={4}
                            />
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <button onClick={() => setReplyingTo(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSendReply} disabled={submittingReply} className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                                {submittingReply ? 'Enviando...' : 'Publicar Resposta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
