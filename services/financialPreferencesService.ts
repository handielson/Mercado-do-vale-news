import { vpsClient } from './vpsClient';

export type FinancialFiltersPreference = {
    tab: 'pagar' | 'receber';
    dataInicio: string;
    dataFim: string;
    filtroSituacao: string;
    searchTerm: string;
};

type PreferenceResponse = {
    key: string;
    value: FinancialFiltersPreference | null;
};

const FINANCE_FILTERS_PREFERENCE_KEY = 'finance.filters';

export const financialPreferencesService = {
    async getFilters(): Promise<FinancialFiltersPreference | null> {
        const response = await vpsClient.get<PreferenceResponse>(
            `/admin/preferences/${encodeURIComponent(FINANCE_FILTERS_PREFERENCE_KEY)}`
        );
        return response?.value || null;
    },

    async saveFilters(filters: FinancialFiltersPreference): Promise<void> {
        await vpsClient.patch<PreferenceResponse>(
            `/admin/preferences/${encodeURIComponent(FINANCE_FILTERS_PREFERENCE_KEY)}`,
            { value: filters }
        );
    },
};
