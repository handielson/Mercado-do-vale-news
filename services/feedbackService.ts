import { CustomerFeedback, FeedbackInput } from '../types/feedback';
import { vpsClient } from './vpsClient';

const TABLE_NAME = 'customer_feedbacks';
const PAGE_LIMIT = 200;

interface TableDataResponse<T> {
    rows: T[];
    total: number;
    limit: number;
    offset: number;
}

async function fetchAllFeedbacks(): Promise<CustomerFeedback[]> {
    const rows: CustomerFeedback[] = [];
    let offset = 0;
    let total = 0;

    do {
        const page = await vpsClient.get<TableDataResponse<CustomerFeedback>>(
            `/table-data/${TABLE_NAME}?limit=${PAGE_LIMIT}&offset=${offset}`,
        );
        rows.push(...(page.rows || []));
        total = Number(page.total || rows.length);
        offset += Number(page.limit || PAGE_LIMIT);
    } while (rows.length < total);

    return rows;
}

function sortNewestFirst(feedbacks: CustomerFeedback[]): CustomerFeedback[] {
    return [...feedbacks].sort((a, b) => {
        const bTime = new Date(b.created_at || 0).getTime();
        const aTime = new Date(a.created_at || 0).getTime();
        return bTime - aTime;
    });
}

export const feedbackService = {
    /**
     * Envia um novo feedback (Acesso Publico Anonimo)
     */
    async submitFeedback(input: FeedbackInput): Promise<void> {
        try {
            await vpsClient.post<{ ok: boolean }>('/public/feedback', input);
        } catch (error) {
            console.error('Erro ao enviar feedback:', error);
            throw new Error('Nao foi possivel enviar sua mensagem. Tente novamente.');
        }
    },

    /**
     * Lista feedbacks (Acesso Admin)
     */
    async listFeedbacks(filters?: { status?: string, type?: string }): Promise<CustomerFeedback[]> {
        try {
            let feedbacks = await fetchAllFeedbacks();

            if (filters?.status && filters.status !== 'all') {
                feedbacks = feedbacks.filter((feedback) => feedback.status === filters.status);
            }

            if (filters?.type && filters.type !== 'all') {
                feedbacks = feedbacks.filter((feedback) => feedback.type === filters.type);
            }

            return sortNewestFirst(feedbacks);
        } catch (error) {
            console.error('Erro ao buscar feedbacks:', error);
            throw error;
        }
    },

    /**
     * Conta mensagens nao lidas para o Dashboard (Acesso Admin)
     */
    async getUnreadCount(): Promise<number> {
        try {
            const feedbacks = await fetchAllFeedbacks();
            return feedbacks.filter((feedback) => feedback.status === 'novo').length;
        } catch (error) {
            console.error('Erro ao contar mensagens novas:', error);
            return 0;
        }
    },

    /**
     * Atualiza o status ou a resposta de um feedback (Acesso Admin)
     */
    async updateFeedback(id: string, updates: Partial<CustomerFeedback>): Promise<CustomerFeedback> {
        try {
            return await vpsClient.patch<CustomerFeedback>(
                `/table-data/${TABLE_NAME}/${encodeURIComponent(id)}`,
                updates,
            );
        } catch (error) {
            console.error('Erro ao atualizar feedback:', error);
            throw new Error('Falha ao atualizar a mensagem.');
        }
    },

    /**
     * Exclui um feedback (Acesso Admin)
     */
    async deleteFeedback(id: string): Promise<void> {
        try {
            await vpsClient.delete(`/table-data/${TABLE_NAME}/${encodeURIComponent(id)}`);
        } catch (error) {
            console.error('Erro ao excluir feedback:', error);
            throw new Error('Falha ao excluir a mensagem.');
        }
    },
};
