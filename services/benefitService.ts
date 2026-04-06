import { supabase } from './supabase';

export interface CustomerBenefit {
    id: string;
    customer_id: string;
    promotion_type: string;
    source_sale_id: string | null;
    granted_at: string;
    expires_at: string | null;
    created_at: string;
}

export interface BenefitRedemption {
    id: string;
    benefit_id: string;
    year_month: string;
    redeemed_at: string;
    redeemed_by: string;
    notes: string | null;
    redeemed_by_user?: {
        name: string;
    };
}

export interface BenefitStatus {
    benefit: CustomerBenefit;
    redemptions: BenefitRedemption[];
    monthsRemaining: number;
    canRedeemThisMonth: boolean;
    currentYearMonth: string;
}

export const benefitService = {
    /**
     * Concede o benefício de película para um cliente
     */
    async grantScreenProtectorBenefit(customerId: string, saleId: string): Promise<CustomerBenefit> {
        const expiresInOneYear = new Date();
        expiresInOneYear.setFullYear(expiresInOneYear.getFullYear() + 1);

        const { data, error } = await supabase
            .from('customer_benefits')
            .insert({
                customer_id: customerId,
                promotion_type: 'one_year_screen_protector',
                source_sale_id: saleId,
                expires_at: expiresInOneYear.toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data as CustomerBenefit;
    },

    /**
     * Lista benefícios e seu histórico de resgate para um cliente específico
     */
    async getCustomerBenefitsStatus(customerId: string): Promise<BenefitStatus[]> {
        const { data: benefits, error: benefitsError } = await supabase
            .from('customer_benefits')
            .select('*')
            .eq('customer_id', customerId)
            .eq('promotion_type', 'one_year_screen_protector')
            .order('granted_at', { ascending: false });

        if (benefitsError) throw benefitsError;
        if (!benefits || benefits.length === 0) return [];

        const statuses: BenefitStatus[] = [];
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        for (const benefit of benefits) {
            // Conta quantos meses se passaram / restam
            const grantedDate = new Date(benefit.granted_at);
            const expiresDate = benefit.expires_at ? new Date(benefit.expires_at) : null;

            // Calculo simples de validade (12 meses totais)
            // Se já passou da validade total, restam 0.
            let monthsRemaining = 0;
            if (expiresDate && now < expiresDate) {
                // Cálculo de meses faltantes grosseiro (apenas para exibição)
                const monthDiff = (expiresDate.getFullYear() - now.getFullYear()) * 12 + (expiresDate.getMonth() - now.getMonth());
                monthsRemaining = Math.max(0, Math.min(12, monthDiff));
            }

            // Busca os resgates deste benefício (Max 12)
            const { data: redemptions, error: redemptionsError } = await supabase
                .from('benefit_redemptions')
                .select(`
                    *,
                    redeemed_by_user:customers!redeemed_by(name)
                `)
                .eq('benefit_id', benefit.id)
                .order('redeemed_at', { ascending: false });

            if (redemptionsError) throw redemptionsError;

            // Checa se já resgatou no mês atual
            const hasRedeemedThisMonth = (redemptions || []).some(r => r.year_month === currentYearMonth);

            // Regras para poder resgatar:
            // 1. Ainda estar dentro da validade (now < expiresDate)
            // 2. Não ter resgatado este mês
            // 3. Ter resgatado menos de 12 vezes no total
            const isExpired = expiresDate ? now > expiresDate : false;
            const totalRedemptions = (redemptions || []).length;
            const canRedeemThisMonth = !isExpired && !hasRedeemedThisMonth && totalRedemptions < 12;

            statuses.push({
                benefit: benefit as CustomerBenefit,
                redemptions: (redemptions || []) as BenefitRedemption[],
                monthsRemaining: isExpired ? 0 : (12 - totalRedemptions),
                canRedeemThisMonth,
                currentYearMonth
            });
        }

        return statuses;
    },

    /**
     * Registra o resgate de uma película na conta do cliente (Apenas Admin)
     */
    async redeemScreenProtector(benefitId: string, adminId: string, notes?: string): Promise<BenefitRedemption> {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // O Unique Constraint no banco (uk_benefit_id_year_month) bloqueará duplicações concorrentes.
        const { data, error } = await supabase
            .from('benefit_redemptions')
            .insert({
                benefit_id: benefitId,
                year_month: currentYearMonth,
                redeemed_by: adminId,
                notes: notes || null
            })
            .select(`
                *,
                redeemed_by_user:customers!redeemed_by(name)
            `)
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('A película deste mês já foi resgatada.');
            }
            throw error;
        }

        return data as BenefitRedemption;
    }
};
