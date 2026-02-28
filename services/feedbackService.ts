import { supabase } from './supabase';
import { CustomerFeedback, FeedbackInput } from '../types/feedback';

const TABLE_NAME = 'customer_feedbacks';

export const feedbackService = {
    /**
     * Busca o ID da empresa a partir da company_settings (fonte de verdade atual)
     */
    async getDefaultCompanyId(): Promise<string> {
        const { data, error } = await supabase
            .from('company_settings')
            .select('id')
            .limit(1)
            .single();

        if (error || !data) {
            console.error('Erro ao buscar company_settings:', error);
            throw new Error('Falha ao identificar a empresa.');
        }

        return data.id;
    },

    /**
     * Envia um novo feedback (Acesso Público Anônimo)
     */
    async submitFeedback(input: FeedbackInput): Promise<void> {
        const companyId = await this.getDefaultCompanyId();

        const { error } = await supabase
            .from(TABLE_NAME)
            .insert([{ ...input, company_id: companyId }]);

        if (error) {
            console.error('Erro ao enviar feedback:', error);
            throw new Error('Não foi possível enviar sua mensagem. Tente novamente.');
        }
    },

    /**
     * Lista feedbacks (Acesso Admin)
     */
    async listFeedbacks(filters?: { status?: string, type?: string }): Promise<CustomerFeedback[]> {
        let query = supabase
            .from(TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false });

        if (filters?.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }

        if (filters?.type && filters.type !== 'all') {
            query = query.eq('type', filters.type);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erro ao buscar feedbacks:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Conta mensagens não lidas para o Dashboard (Acesso Admin)
     */
    async getUnreadCount(): Promise<number> {
        const { count, error } = await supabase
            .from(TABLE_NAME)
            .select('*', { count: 'exact', head: true })
            .eq('status', 'novo');

        if (error) {
            console.error('Erro ao contar mensagens novas:', error);
            return 0; // Return 0 non-destructively for dashboard
        }

        return count || 0;
    },

    /**
     * Atualiza o status ou a resposta de um feedback (Acesso Admin)
     */
    async updateFeedback(id: string, updates: Partial<CustomerFeedback>): Promise<CustomerFeedback> {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar feedback:', error);
            throw new Error('Falha ao atualizar a mensagem.');
        }

        return data;
    },

    /**
     * Exclui um feedback (Acesso Admin)
     */
    async deleteFeedback(id: string): Promise<void> {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao excluir feedback:', error);
            throw new Error('Falha ao excluir a mensagem.');
        }
    }
};
