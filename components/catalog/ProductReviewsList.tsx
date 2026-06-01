import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, User as UserIcon, Loader2, Send, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useVpsAuth } from '../../contexts/VpsAuthContext';
import { reviewService } from '../../services/reviews';
import { ProductReview } from '../../types/review';

interface ProductReviewsListProps {
    productId: string;
}

export const ProductReviewsList: React.FC<ProductReviewsListProps> = ({ productId }) => {
    const { user, customer } = useVpsAuth();
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    
    // Form state
    const [rating, setRating] = useState(5);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchReviews();
    }, [productId]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const data = await reviewService.getProductReviews(productId);
            setReviews(data);
        } catch (error) {
            console.error('Erro ao buscar reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user || !customer) {
            toast.error('Você precisa estar logado para avaliar.');
            return;
        }

        if (rating < 1 || rating > 5) {
            toast.error('Por favor, selecione uma nota de 1 a 5 estrelas.');
            return;
        }

        try {
            setSubmitting(true);
            await reviewService.submitReview({
                product_id: productId,
                rating,
                review_text: reviewText.trim() ? reviewText : undefined
            }, customer.id);
            
            toast.success('Sua avaliação foi enviada e está em análise!');
            setShowForm(false);
            setRating(5);
            setReviewText('');
        } catch (error: any) {
            toast.error(error.message || 'Houve um erro ao enviar sua avaliação.');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculos
    const averageRating = reviews.length > 0 
        ? reviews.reduce((acc, rev) => acc + rev.rating, 0) / reviews.length 
        : 0;

    return (
        <div className="border-t border-slate-200 mt-6 pt-6">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                Avaliações de Clientes
            </h3>

            {/* Cabeçalho das Avaliações (Resumo) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-slate-50 p-4 rounded-xl">
                <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-slate-800">
                        {averageRating > 0 ? averageRating.toFixed(1) : '-'}
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                    key={star} 
                                    className={`w-4 h-4 ${star <= Math.round(averageRating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 fill-slate-300'}`} 
                                />
                            ))}
                        </div>
                        <span className="text-sm text-slate-500 font-medium">
                            {reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'}
                        </span>
                    </div>
                </div>

                {!showForm && (
                     <button
                        onClick={() => {
                            if (!user) {
                                toast.error('Faça login para poder avaliar!');
                            } else {
                                setShowForm(true);
                            }
                        }}
                        className="px-4 py-2 bg-blue-50 text-blue-700 font-semibold rounded-lg hover:bg-blue-100 transition-colors"
                    >
                        Escrever Avaliação
                    </button>
                )}
            </div>

            {/* Formulário de Nova Avaliação */}
            {showForm && (
                <form onSubmit={handleSubmit} className="mb-8 p-4 border border-blue-200 bg-white rounded-xl shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4">Sua avaliação</h4>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nota</label>
                        <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    type="button"
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                                >
                                    <Star 
                                        className={`w-8 h-8 ${star <= (hoverRating || rating) ? 'text-yellow-400 fill-yellow-400 cursor-pointer drop-shadow-sm' : 'text-slate-200 fill-slate-200 cursor-pointer'}`} 
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Comentário (Opcional)</label>
                        <textarea
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                            rows={3}
                            placeholder="Conte para os outros o que você achou deste produto..."
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-4">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                            disabled={submitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-75"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Avaliar
                        </button>
                    </div>
                </form>
            )}

            {/* Lista de Avaliações */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-slate-500 mt-2 text-sm">Carregando avaliações...</p>
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-slate-100 rounded-xl">
                    <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-semibold text-slate-700">Seja o primeiro a avaliar!</h4>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                        Ainda não há avaliações para este produto. Participe e ganhe <strong>Moedas do Vale</strong> recompensas.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((review) => (
                        <div key={review.id} className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm transition-shadow">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    {review.customer?.avatar_url ? (
                                        <img 
                                            src={review.customer.avatar_url} 
                                            alt={review.customer.name}
                                            className="w-10 h-10 rounded-full object-cover border-2 border-slate-100"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-50 flex items-center justify-center">
                                            <UserIcon className="w-5 h-5 text-slate-400" />
                                        </div>
                                    )}
                                    
                                    <div>
                                        <p className="font-semibold text-slate-800 text-sm">
                                            {review.customer?.name ? review.customer.name.split(' ')[0] : 'Cliente'}
                                        </p>
                                        <div className="flex mt-0.5">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star 
                                                    key={star} 
                                                    className={`w-3.5 h-3.5 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 fill-slate-200'}`} 
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                                    {new Date(review.created_at).toLocaleDateString('pt-BR')}
                                </span>
                            </div>

                            {review.review_text && (
                                <p className="mt-3 text-slate-700 text-sm leading-relaxed">
                                    {review.review_text}
                                </p>
                            )}

                            {review.admin_reply && (
                                <div className="mt-4 pl-4 border-l-2 border-blue-200 bg-blue-50/50 p-3 rounded-r-lg">
                                    <p className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1.5">
                                        <Shield className="w-3 h-3" /> Resposta da Loja
                                    </p>
                                    <p className="text-sm text-slate-700">{review.admin_reply}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
