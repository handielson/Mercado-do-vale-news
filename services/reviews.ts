import { ProductReview, ReviewInput } from '../types/review';
import { earnCoinsForReview } from './cashbackService';
import { vpsClient } from './vpsClient';

interface TableDataResponse<T> {
    rows?: T[];
}

interface CustomerSummary {
    id: string;
    name: string;
    avatar_url: string | null;
}

let pendingResolvers = new Map<string, ((data: ProductReview[]) => void)[]>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function loadTableRows<T>(table: string, pageSize = 200): Promise<T[]> {
    const allRows: T[] = [];

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse<T>>(
            `/table-data/${table}?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows;
}

function sortNewestFirst(reviews: ProductReview[]): ProductReview[] {
    return [...reviews].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

async function loadReviews(): Promise<ProductReview[]> {
    return sortNewestFirst(await loadTableRows<ProductReview>('product_reviews'));
}

async function enrichCustomers(reviews: ProductReview[]): Promise<ProductReview[]> {
    if (reviews.length === 0) return reviews;

    const customers = await loadTableRows<CustomerSummary>('customers');
    const customersById = new Map(customers.map(customer => [String(customer.id), customer]));

    return reviews.map(review => ({
        ...review,
        customer: customersById.get(String(review.customer_id))
            ? {
                name: String(customersById.get(String(review.customer_id))!.name || 'Cliente'),
                avatar_url: customersById.get(String(review.customer_id))!.avatar_url || null,
            }
            : review.customer,
    }));
}

async function flushReviewsBatch() {
    const resolvers = pendingResolvers;
    pendingResolvers = new Map();
    batchTimer = null;
    const ids = Array.from(resolvers.keys());
    if (ids.length === 0) return;

    try {
        const grouped = await Promise.all(ids.map(async (productId) => ({
            productId,
            reviews: await vpsClient.get<ProductReview[]>(`/public/products/${encodeURIComponent(productId)}/reviews`),
        })));

        const byProduct = new Map<string, ProductReview[]>();
        grouped.forEach(({ productId, reviews }) => byProduct.set(productId, Array.isArray(reviews) ? reviews : []));

        resolvers.forEach((rs, productId) => {
            const list = byProduct.get(productId) || [];
            rs.forEach(r => r(list));
        });
    } catch (error) {
        console.error('Erro ao buscar avaliacoes em lote:', error);
        resolvers.forEach(rs => rs.forEach(r => r([])));
    }
}

export const reviewService = {
    /**
     * Busca todas as avaliacoes aprovadas de um produto.
     * Batches multiple concurrent calls em uma janela curta para evitar leituras repetidas.
     */
    getProductReviews: async (productId: string): Promise<ProductReview[]> => {
        return new Promise(resolve => {
            if (!pendingResolvers.has(productId)) pendingResolvers.set(productId, []);
            pendingResolvers.get(productId)!.push(resolve);
            if (!batchTimer) batchTimer = setTimeout(flushReviewsBatch, 50);
        });
    },

    /**
     * Envia uma nova avaliacao.
     * A avaliacao vai como pending para moderacao.
     */
    submitReview: async (review: ReviewInput, customerId: string): Promise<ProductReview | null> => {
        try {
            return await vpsClient.post<ProductReview>('/customer/reviews', {
                product_id: review.product_id,
                rating: review.rating,
                review_text: review.review_text,
            });
        } catch (error) {
            console.error('Erro ao enviar avaliacao:', error);
            throw new Error('Falha ao registrar avaliacao.');
        }
    },

    /**
     * Apenas Admin: busca avaliacoes pendentes ou todas.
     */
    getAdminReviews: async (statusFilter?: 'pending' | 'approved' | 'hidden'): Promise<ProductReview[]> => {
        const reviews = await enrichCustomers(await loadReviews());
        return statusFilter
            ? reviews.filter(review => review.status === statusFilter)
            : reviews;
    },

    /**
     * Apenas Admin: atualiza status da avaliacao.
     */
    updateReviewStatus: async (reviewId: string, status: 'approved' | 'hidden'): Promise<void> => {
        const data = await vpsClient.patch<ProductReview>(
            `/table-data/product_reviews/${encodeURIComponent(reviewId)}?pk=id`,
            { status }
        );

        if (status === 'approved' && data) {
            try {
                await earnCoinsForReview(data.customer_id, data.id);
            } catch (ignored) {
                // Falha silenciosamente se moedas estiverem desativadas ou houver duplicidade.
            }
        }
    },

    replyToReview: async (reviewId: string, replyText: string): Promise<void> => {
        await vpsClient.patch(
            `/table-data/product_reviews/${encodeURIComponent(reviewId)}?pk=id`,
            { admin_reply: replyText }
        );
    },

    deleteReview: async (reviewId: string): Promise<void> => {
        await vpsClient.delete(`/table-data/product_reviews/${encodeURIComponent(reviewId)}?pk=id`);
    },
};
