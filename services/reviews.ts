import { supabase } from './supabase';
import { ProductReview, ReviewInput } from '../types/review';
import { earnCoinsForReview } from './cashbackService';

export const reviewService = {
    /**
     * Busca todas as avaliações aprovadas de um produto
     */
    getProductReviews: async (productId: string): Promise<ProductReview[]> => {
        const { data, error } = await supabase
            .from('product_reviews')
            .select(`
                *,
                customer:customers(name, avatar_url)
            `)
            .eq('product_id', productId)
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

            // 'customer' is returned as an array or object depending on relation, usually object
            // Let's format it to ensure it matches the interface
            
        if (error) {
            console.error('Erro ao buscar avaliações:', error);
            return [];
        }

        return data.map(review => ({
            ...review,
            customer: Array.isArray(review.customer) ? review.customer[0] : review.customer
        })) as ProductReview[];
    },

    /**
     * Envia uma nova avaliação.
     * Cuidado: A avaliação pode ir para "pending" (pendente) dependendo da regra de moderação adotada.
     */
    submitReview: async (review: ReviewInput, customerId: string): Promise<ProductReview | null> => {
        const { data, error } = await supabase
            .from('product_reviews')
            .insert({
                product_id: review.product_id,
                customer_id: customerId,
                rating: review.rating,
                review_text: review.review_text,
                status: 'pending' // Envia como pendente por padrão
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao enviar avaliação:', error);
            throw new Error('Falha ao registrar avaliação.');
        }

        return data as ProductReview;
    },

    /**
     * (Apenas Admin) Busca avaliações pendentes ou todas
     */
    getAdminReviews: async (statusFilter?: 'pending' | 'approved' | 'hidden'): Promise<ProductReview[]> => {
        let query = supabase
            .from('product_reviews')
            .select(`
                *,
                customer:customers(name, avatar_url)
            `)
            .order('created_at', { ascending: false });

        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        return data.map(review => ({
            ...review,
            customer: Array.isArray(review.customer) ? review.customer[0] : review.customer
        })) as ProductReview[];
    },

    /**
     * (Apenas Admin) Atualiza status da avaliação
     */
    updateReviewStatus: async (reviewId: string, status: 'approved' | 'hidden'): Promise<void> => {
        const { error, data } = await supabase
            .from('product_reviews')
            .update({ status })
            .eq('id', reviewId)
            .select()
            .single();

        if (error) throw error;

        // Se foi aprovado, podemos dar as moedas ao cliente (se aplicável e se ainda não deu)
        // Isso idealmente ficaria em uma TRIGGER do DB ou Edge Function, mas para simplificar:
        if (status === 'approved' && data) {
            try {
                // Checa se já ganhou moedas ou simplesmente chama o cashback service
                await earnCoinsForReview(data.customer_id, data.id);
            } catch (ignored) {
                // Falha silenciosamente se moedas estiverem desativadas ou der duplicidade
            }
        }
    },

    replyToReview: async (reviewId: string, replyText: string): Promise<void> => {
        const { error } = await supabase
            .from('product_reviews')
            .update({ admin_reply: replyText })
            .eq('id', reviewId);

        if (error) throw error;
    }
};
