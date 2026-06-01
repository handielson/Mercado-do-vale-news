import { vpsClient } from './vpsClient';

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

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };

interface CustomerSummary {
    id: string;
    name: string | null;
}

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

async function loadTableRows<T>(table: string, pageSize = 200): Promise<T[]> {
    let offset = 0;
    const rows: T[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<T>>(
            `/table-data/${table}?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

async function loadCustomerBenefits(pageSize = 200): Promise<CustomerBenefit[]> {
    return loadTableRows<CustomerBenefit>('customer_benefits', pageSize);
}

async function loadBenefitRedemptions(pageSize = 200): Promise<BenefitRedemption[]> {
    return loadTableRows<BenefitRedemption>('benefit_redemptions', pageSize);
}

async function buildCustomerNameMap(): Promise<Map<string, string>> {
    const customers = await loadTableRows<CustomerSummary>('customers');
    return new Map(customers.map((customer) => [customer.id, customer.name || '']));
}

function enrichRedemptions(
    redemptions: BenefitRedemption[],
    customerNames: Map<string, string>,
): BenefitRedemption[] {
    return redemptions.map((redemption) => {
        const name = customerNames.get(redemption.redeemed_by);
        return name ? { ...redemption, redeemed_by_user: { name } } : redemption;
    });
}

export const benefitService = {
    /**
     * Concede o beneficio de pelicula para um cliente.
     */
    async grantScreenProtectorBenefit(customerId: string, saleId: string): Promise<CustomerBenefit> {
        const expiresInOneYear = new Date();
        expiresInOneYear.setFullYear(expiresInOneYear.getFullYear() + 1);

        return vpsClient.post<CustomerBenefit>('/table-data/customer_benefits', {
            customer_id: customerId,
            promotion_type: 'one_year_screen_protector',
            source_sale_id: saleId,
            expires_at: expiresInOneYear.toISOString()
        });
    },

    /**
     * Lista beneficios e historico de resgate para um cliente especifico.
     */
    async getCustomerBenefitsStatus(customerId: string): Promise<BenefitStatus[]> {
        const benefits = (await loadCustomerBenefits())
            .filter(benefit =>
                benefit.customer_id === customerId &&
                benefit.promotion_type === 'one_year_screen_protector'
            )
            .sort((a, b) => String(b.granted_at).localeCompare(String(a.granted_at)));

        if (!benefits || benefits.length === 0) return [];

        const statuses: BenefitStatus[] = [];
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const allRedemptions = await loadBenefitRedemptions();
        const customerNames = await buildCustomerNameMap();

        for (const benefit of benefits) {
            const expiresDate = benefit.expires_at ? new Date(benefit.expires_at) : null;

            const redemptions = enrichRedemptions(
                allRedemptions
                    .filter((redemption) => redemption.benefit_id === benefit.id)
                    .sort((a, b) => String(b.redeemed_at).localeCompare(String(a.redeemed_at))),
                customerNames,
            );

            const hasRedeemedThisMonth = redemptions.some(r => r.year_month === currentYearMonth);
            const isExpired = expiresDate ? now > expiresDate : false;
            const totalRedemptions = redemptions.length;
            const canRedeemThisMonth = !isExpired && !hasRedeemedThisMonth && totalRedemptions < 12;

            statuses.push({
                benefit,
                redemptions,
                monthsRemaining: isExpired ? 0 : (12 - totalRedemptions),
                canRedeemThisMonth,
                currentYearMonth
            });
        }

        return statuses;
    },

    /**
     * Registra o resgate de uma pelicula na conta do cliente.
     */
    async redeemScreenProtector(benefitId: string, adminId: string, notes?: string): Promise<BenefitRedemption> {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const existingRedemption = (await loadBenefitRedemptions())
            .find((redemption) => redemption.benefit_id === benefitId && redemption.year_month === currentYearMonth);

        if (existingRedemption) {
            throw new Error('A pelicula deste mes ja foi resgatada.');
        }

        const redemption = await vpsClient.post<BenefitRedemption>('/table-data/benefit_redemptions', {
            benefit_id: benefitId,
            year_month: currentYearMonth,
            redeemed_by: adminId,
            notes: notes || null
        });

        const customerNames = await buildCustomerNameMap();
        return enrichRedemptions([redemption], customerNames)[0];
    }
};
