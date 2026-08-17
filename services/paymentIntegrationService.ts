import type { PaymentIntegration, PaymentIntegrationInput, PaymentGatewayName } from '../types/paymentIntegration';
import { getCompanyId } from './companyContext';
import { vpsClient } from './vpsClient';

interface TableDataResponse {
    rows?: PaymentIntegration[];
}

export type PublicCheckoutPaymentIntegration = Pick<
    PaymentIntegration,
    'gateway_name' | 'is_active' | 'public_key' | 'environment'
>;

async function loadPaymentIntegrations(companyId: string): Promise<PaymentIntegration[]> {
    const allRows: PaymentIntegration[] = [];
    const pageSize = 200;

    for (let offset = 0; ; offset += pageSize) {
        const data = await vpsClient.get<TableDataResponse>(
            `/table-data/payment_integrations?limit=${pageSize}&offset=${offset}`
        );
        const rows = Array.isArray(data.rows) ? data.rows : [];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
    }

    return allRows
        .filter(row => String(row.company_id) === String(companyId))
        .sort((a, b) => String(a.gateway_name).localeCompare(String(b.gateway_name)));
}

export const paymentIntegrationService = {
    async getPublicCheckoutIntegrations(): Promise<PublicCheckoutPaymentIntegration[]> {
        const integrations = await vpsClient.get<PublicCheckoutPaymentIntegration[]>('/public/payment-integrations');
        return (Array.isArray(integrations) ? integrations : [])
            .filter(integration => integration.is_active)
            .sort((a, b) => String(a.gateway_name).localeCompare(String(b.gateway_name)));
    },

    async getIntegrations(): Promise<PaymentIntegration[]> {
        const companyId = await getCompanyId();
        return loadPaymentIntegrations(companyId);
    },

    async getIntegrationByGateway(gatewayName: PaymentGatewayName): Promise<PaymentIntegration | null> {
        const companyId = await getCompanyId();
        const integrations = await loadPaymentIntegrations(companyId);
        return integrations.find(integration => integration.gateway_name === gatewayName) || null;
    },

    async upsertIntegration(input: PaymentIntegrationInput): Promise<PaymentIntegration> {
        const companyId = await getCompanyId();
        const integrations = await loadPaymentIntegrations(companyId);
        const existing = integrations.find(integration => integration.gateway_name === input.gateway_name);

        const rowData = {
            company_id: companyId,
            gateway_name: input.gateway_name,
            is_active: input.is_active,
            public_key: input.public_key,
            access_token: input.access_token,
            client_id: input.client_id,
            client_secret: input.client_secret,
            environment: input.environment,
            updated_at: new Date().toISOString()
        };

        if (existing) {
            return vpsClient.patch<PaymentIntegration>(
                `/table-data/payment_integrations/${encodeURIComponent(existing.id)}?pk=id`,
                rowData
            );
        }

        return vpsClient.post<PaymentIntegration>('/table-data/payment_integrations', rowData);
    },

    async deleteIntegration(id: string): Promise<void> {
        await vpsClient.delete(`/table-data/payment_integrations/${encodeURIComponent(id)}?pk=id`);
    }
};
